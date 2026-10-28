import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, EntityManager, IsNull } from 'typeorm';
import {
  addDays,
  buildCashFlow,
  buildDre,
  projectedDate,
  todayIn,
  zonedParts,
  zonedToUtc,
  type CashFlowDto,
  type DreDto,
  type FlowEvent,
} from '@skedulei/contracts';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { mainUnit } from './cash.service';
import { CommissionsService } from './commissions.service';
import { CashflowQueryDto } from './dto/ledger.dto';
import { PeriodQueryDto } from './dto/finance.dto';
import { CommissionPayout } from './entities/commission.entity';
import { Payable, Receivable } from './entities/ledger.entity';

const MAX_REALIZED_DAYS = 366;

@Injectable()
export class ReportsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly commissions: CommissionsService,
  ) {}

  /**
   * DRE gerencial. Receitas e comissões pelas comandas pagas no período; receitas avulsas pela data
   * recebida; despesas fixas pelas contas a pagar pagas no período, por categoria.
   */
  async dre(org: OrgContext, q: PeriodQueryDto): Promise<DreDto> {
    const s = await this.commissions.summary(org, q);
    return this.tenant.transaction(async (em) => {
      const [other, expenses] = await Promise.all([
        em
          .getRepository(Receivable)
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.amountCents), 0)', 'sum')
          .where('r.organizationId = :org AND r.source = :src AND r.receivedDate BETWEEN :from AND :to', { org: org.organizationId, src: 'AVULSO', from: q.from, to: q.to })
          .getRawOne<{ sum: string }>(),
        em
          .getRepository(Payable)
          .createQueryBuilder('p')
          .leftJoin('p.category', 'c')
          .select('p.categoryId', 'categoryId')
          .addSelect(`COALESCE(c.name, 'Sem categoria')`, 'name')
          .addSelect('SUM(p.amountCents)', 'cents')
          .where('p.organizationId = :org AND p.paidDate BETWEEN :from AND :to', { org: org.organizationId, from: q.from, to: q.to })
          .groupBy('p.categoryId')
          .addGroupBy('c.name')
          .getRawMany<{ categoryId: string | null; name: string; cents: string }>(),
      ]);
      const dre = buildDre({
        salesGrossCents: s.grossCents,
        otherRevenueCents: Number(other?.sum ?? 0),
        discountsCents: s.discountsCents,
        feesCents: s.feesCents,
        commissionsCents: s.commissionsCents,
        expenses: expenses.map((e) => ({ categoryId: e.categoryId, name: e.name, cents: Number(e.cents) })),
      });
      return { from: q.from, to: q.to, ...dre };
    });
  }

  /**
   * Fluxo de caixa. Realizado: recebíveis baixados − contas pagas − fechamentos de comissão, por data.
   * Projetado (30/60/90 dias a partir de hoje): recebíveis a cair − contas a vencer; o que já venceu e
   * ainda não foi baixado entra hoje.
   */
  async cashflow(org: OrgContext, q: CashflowQueryDto): Promise<CashFlowDto> {
    return this.tenant.transaction(async (em) => {
      const tz = (await mainUnit(em, org.organizationId)).timezone;
      const today = todayIn(tz);
      if (q.mode === 'PROJETADO') {
        const days = q.days ?? 30;
        const to = addDays(today, days - 1);
        const [rec, pay] = await Promise.all([
          em.getRepository(Receivable).find({ where: { organizationId: org.organizationId, receivedDate: IsNull() } }),
          em.getRepository(Payable).find({ where: { organizationId: org.organizationId, paidDate: IsNull() } }),
        ]);
        const flow = buildCashFlow({
          from: today,
          to,
          bucket: q.bucket ?? (days > 30 ? 'semana' : 'dia'),
          inflows: rec.map((r) => ({ date: projectedDate(r.expectedDate, today), cents: r.amountCents })),
          outflows: pay.map((p) => ({ date: projectedDate(p.dueDate, today), cents: p.amountCents })),
        });
        return { mode: 'PROJETADO', ...flow };
      }
      const to = q.to ?? today;
      const from = q.from ?? addDays(to, -29);
      if (to < from) throw new BadRequestException('O fim do período vem antes do início');
      if (to > addDays(from, MAX_REALIZED_DAYS)) throw new BadRequestException('Período máximo de 1 ano');
      const [rec, pay, payouts] = await Promise.all([
        em.getRepository(Receivable).find({ where: { organizationId: org.organizationId, receivedDate: Between(from, to) } }),
        em.getRepository(Payable).find({ where: { organizationId: org.organizationId, paidDate: Between(from, to) } }),
        this.payouts(em, org.organizationId, from, to, tz),
      ]);
      const flow = buildCashFlow({
        from,
        to,
        bucket: q.bucket ?? (to > addDays(from, 45) ? 'semana' : 'dia'),
        inflows: rec.map((r) => ({ date: r.receivedDate!, cents: r.amountCents })),
        outflows: [...pay.map((p) => ({ date: p.paidDate!, cents: p.amountCents })), ...payouts],
      });
      return { mode: 'REALIZADO', ...flow };
    });
  }

  private async payouts(em: EntityManager, organizationId: string, from: string, to: string, tz: string): Promise<FlowEvent[]> {
    const rows = await em
      .getRepository(CommissionPayout)
      .createQueryBuilder('c')
      .where('c.organizationId = :organizationId AND c.createdAt >= :start AND c.createdAt < :end', {
        organizationId,
        start: zonedToUtc(from, '00:00', tz),
        end: zonedToUtc(addDays(to, 1), '00:00', tz),
      })
      .getMany();
    return rows.filter((r) => r.totalCents > 0).map((r) => ({ date: zonedParts(r.createdAt, tz).date, cents: r.totalCents }));
  }
}
