import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import {
  addDays,
  can,
  OrderItemKind,
  OrderStatus,
  orderTotals,
  Permission,
  todayIn,
  zonedParts,
  zonedToUtc,
  type AdvanceDto as AdvanceResponse,
  type CommissionBalanceDto,
  type CommissionEntryDto,
  type CommissionPayoutDto,
  type FinanceSummaryDto,
} from '@skedulei/contracts';
import { Member } from '../organizations/entities/member.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { mainUnit } from './cash.service';
import { AdvanceDto, PayoutDto, PeriodQueryDto } from './dto/finance.dto';
import { Advance, CommissionEntry, CommissionPayout } from './entities/commission.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { Order } from './entities/order.entity';

@Injectable()
export class CommissionsService {
  constructor(private readonly tenant: TenantDb) {}

  /** Quem vê tudo (financeiro) ou só a própria comissão (profissional). */
  private scope(org: OrgContext, memberId?: string): string | null {
    if (can(org.role, Permission.FINANCE_VIEW)) return memberId ?? null;
    if (can(org.role, Permission.COMMISSIONS_OWN)) {
      if (memberId && memberId !== org.memberId) throw new ForbiddenException('Você só vê a sua comissão');
      return org.memberId;
    }
    throw new ForbiddenException('Seu perfil não vê comissões');
  }

  async balances(org: OrgContext): Promise<CommissionBalanceDto[]> {
    const only = this.scope(org);
    return this.tenant.transaction(async (em) => {
      const entries = await em.getRepository(CommissionEntry).find({
        where: { organizationId: org.organizationId, payoutId: IsNull(), ...(only ? { memberId: only } : {}) },
      });
      const advances = await em.getRepository(Advance).find({
        where: { organizationId: org.organizationId, payoutId: IsNull(), ...(only ? { memberId: only } : {}) },
      });
      const ids = [...new Set([...entries.map((e) => e.memberId), ...advances.map((a) => a.memberId)])];
      const names = await this.names(em, org, ids);
      return ids
        .map((memberId) => {
          const mine = entries.filter((e) => e.memberId === memberId);
          const commissionsCents = mine.reduce((s, e) => s + e.amountCents, 0);
          const advancesCents = advances.filter((a) => a.memberId === memberId).reduce((s, a) => s + a.amountCents, 0);
          return { memberId, memberName: names.get(memberId) ?? '', commissionsCents, advancesCents, balanceCents: commissionsCents - advancesCents, entries: mine.length };
        })
        .sort((a, b) => a.memberName.localeCompare(b.memberName));
    });
  }

  async entries(org: OrgContext, memberId?: string): Promise<CommissionEntryDto[]> {
    const only = this.scope(org, memberId);
    return this.tenant.transaction(async (em) => {
      const rows = await em.getRepository(CommissionEntry).find({
        where: { organizationId: org.organizationId, ...(only ? { memberId: only } : {}) },
        relations: { member: true, order: true },
        order: { createdAt: 'DESC' },
        take: 200,
      });
      return rows.map((e) => ({
        id: e.id,
        memberId: e.memberId,
        memberName: e.member.name,
        orderNumber: e.order.number,
        description: e.description,
        baseCents: e.baseCents,
        bps: e.bps,
        amountCents: e.amountCents,
        createdAt: e.createdAt.toISOString(),
        payoutId: e.payoutId,
      }));
    });
  }

  async advances(org: OrgContext, memberId?: string): Promise<AdvanceResponse[]> {
    const only = this.scope(org, memberId);
    return this.tenant.transaction(async (em) => {
      const rows = await em.getRepository(Advance).find({
        where: { organizationId: org.organizationId, ...(only ? { memberId: only } : {}) },
        relations: { member: true },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      return rows.map((a) => ({ id: a.id, memberId: a.memberId, memberName: a.member.name, amountCents: a.amountCents, note: a.note, date: a.date, payoutId: a.payoutId }));
    });
  }

  async addAdvance(org: OrgContext, dto: AdvanceDto): Promise<AdvanceResponse> {
    return this.tenant.transaction(async (em) => {
      const m = await em.getRepository(Member).findOne({ where: { id: dto.memberId, organizationId: org.organizationId } });
      if (!m) throw new NotFoundException('Profissional não encontrado');
      const unit = await mainUnit(em, org.organizationId);
      const a = await em.getRepository(Advance).save(
        em.getRepository(Advance).create({
          organizationId: org.organizationId,
          memberId: m.id,
          amountCents: dto.amountCents,
          note: dto.note ?? null,
          date: dto.date ?? todayIn(unit.timezone),
          payoutId: null,
          createdByMemberId: org.memberId,
        }),
      );
      return { id: a.id, memberId: a.memberId, memberName: m.name, amountCents: a.amountCents, note: a.note, date: a.date, payoutId: null };
    });
  }

  async payouts(org: OrgContext): Promise<CommissionPayoutDto[]> {
    const only = this.scope(org);
    return this.tenant.transaction(async (em) => {
      const rows = await em.getRepository(CommissionPayout).find({
        where: { organizationId: org.organizationId, ...(only ? { memberId: only } : {}) },
        relations: { member: true },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      return rows.map((p) => this.payoutDto(p, p.member.name));
    });
  }

  /** Fechamento: tudo que está em aberto do profissional (comissões − vales) vira um pagamento. */
  async createPayout(org: OrgContext, dto: PayoutDto): Promise<CommissionPayoutDto> {
    return this.tenant.transaction(async (em) => {
      const m = await em.getRepository(Member).findOne({ where: { id: dto.memberId, organizationId: org.organizationId } });
      if (!m) throw new NotFoundException('Profissional não encontrado');
      // Trava a pessoa: dois fechamentos simultâneos não pegam as mesmas comissões.
      await em.getRepository(Member).createQueryBuilder('m').setLock('pessimistic_write').where('m.id = :id', { id: m.id }).getOne();
      const entries = await em.getRepository(CommissionEntry).find({ where: { organizationId: org.organizationId, memberId: m.id, payoutId: IsNull() } });
      const advances = await em.getRepository(Advance).find({ where: { organizationId: org.organizationId, memberId: m.id, payoutId: IsNull() } });
      if (!entries.length && !advances.length) throw new BadRequestException('Nada em aberto para fechar');
      const commissionsCents = entries.reduce((s, e) => s + e.amountCents, 0);
      const advancesCents = advances.reduce((s, a) => s + a.amountCents, 0);
      const payout = await em.getRepository(CommissionPayout).save(
        em.getRepository(CommissionPayout).create({
          organizationId: org.organizationId,
          memberId: m.id,
          commissionsCents,
          advancesCents,
          totalCents: commissionsCents - advancesCents,
          entries: entries.length,
          createdByMemberId: org.memberId,
        }),
      );
      if (entries.length) await em.getRepository(CommissionEntry).update(entries.map((e) => e.id), { payoutId: payout.id });
      if (advances.length) await em.getRepository(Advance).update(advances.map((a) => a.id), { payoutId: payout.id });
      return this.payoutDto(payout, m.name);
    });
  }

  // ---------------------------------------------------------------- resumo financeiro

  /** Painel do dono: faturamento, taxas, líquido, comissões, por forma, profissional, serviço e dia. */
  async summary(org: OrgContext, q: PeriodQueryDto): Promise<FinanceSummaryDto> {
    if (q.to < q.from) throw new BadRequestException('O fim do período vem antes do início');
    if (q.to > addDays(q.from, 366)) throw new BadRequestException('Período máximo de 1 ano');
    return this.tenant.transaction(async (em) => {
      const unit = await mainUnit(em, org.organizationId);
      const tz = unit.timezone;
      const start = zonedToUtc(q.from, '00:00', tz);
      const end = zonedToUtc(addDays(q.to, 1), '00:00', tz);
      const orders = await em
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.organizationId = :org AND o.status = :closed', { org: org.organizationId, closed: OrderStatus.FECHADA })
        .andWhere('o.closedAt >= :start AND o.closedAt < :end', { start, end })
        .getMany();
      const ids = orders.map((o) => o.id);
      const [items, payments, commissions] = ids.length
        ? await Promise.all([
            em.getRepository(OrderItem).createQueryBuilder('i').leftJoinAndSelect('i.member', 'm').where('i.orderId IN (:...ids)', { ids }).getMany(),
            em.getRepository(OrderPayment).createQueryBuilder('p').where('p.orderId IN (:...ids)', { ids }).getMany(),
            em.getRepository(CommissionEntry).createQueryBuilder('c').where('c.orderId IN (:...ids)', { ids }).getMany(),
          ])
        : [[], [], []];

      let gross = 0;
      let discounts = 0;
      let revenue = 0;
      const byPro = new Map<string, { memberId: string; name: string; revenueCents: number; commissionsCents: number; items: number }>();
      const byService = new Map<string, { name: string; revenueCents: number; quantity: number }>();
      const byDay = new Map<string, number>();
      for (const o of orders) {
        const its = items.filter((i) => i.orderId === o.id);
        const t = orderTotals(its, o.totalDiscountCents);
        // Venda de vale-presente não é receita: vira receita quando o vale é usado (como pagamento de outra comanda).
        let valeGross = 0;
        let valeNet = 0;
        its.forEach((i, k) => {
          if (i.kind === OrderItemKind.VALE) {
            valeGross += i.quantity * i.unitPriceCents;
            valeNet += t.itemNetCents[k];
          }
        });
        const orderRevenue = t.totalCents - valeNet;
        gross += t.subtotalCents - valeGross;
        discounts += t.discountCents - (valeGross - valeNet);
        revenue += orderRevenue;
        const day = zonedParts(o.closedAt!, tz).date;
        byDay.set(day, (byDay.get(day) ?? 0) + orderRevenue);
        its.forEach((i, k) => {
          if (i.kind === OrderItemKind.VALE) return;
          const svc = byService.get(i.description) ?? { name: i.description, revenueCents: 0, quantity: 0 };
          svc.revenueCents += t.itemNetCents[k];
          svc.quantity += i.quantity;
          byService.set(i.description, svc);
          if (i.memberId) {
            const p = byPro.get(i.memberId) ?? { memberId: i.memberId, name: i.member?.name ?? '', revenueCents: 0, commissionsCents: 0, items: 0 };
            p.revenueCents += t.itemNetCents[k];
            p.items += i.quantity;
            byPro.set(i.memberId, p);
          }
        });
      }
      for (const c of commissions) {
        const p = byPro.get(c.memberId);
        if (p) p.commissionsCents += c.amountCents;
      }
      const fees = payments.reduce((s, p) => s + p.feeCents, 0);
      const byMethod = new Map<string, { amountCents: number; feesCents: number }>();
      for (const p of payments) {
        const m = byMethod.get(p.method) ?? { amountCents: 0, feesCents: 0 };
        m.amountCents += p.amountCents;
        m.feesCents += p.feeCents;
        byMethod.set(p.method, m);
      }
      const commissionsCents = commissions.reduce((s, c) => s + c.amountCents, 0);
      const days: string[] = [];
      for (let d = q.from; d <= q.to && days.length < 400; d = addDays(d, 1)) days.push(d);

      return {
        from: q.from,
        to: q.to,
        orders: orders.length,
        grossCents: gross,
        discountsCents: discounts,
        revenueCents: revenue,
        feesCents: fees,
        netCents: revenue - fees,
        commissionsCents,
        averageTicketCents: orders.length ? Math.round(revenue / orders.length) : 0,
        byMethod: [...byMethod.entries()].map(([method, v]) => ({ method: method as never, ...v })).sort((a, b) => b.amountCents - a.amountCents),
        byProfessional: [...byPro.values()].sort((a, b) => b.revenueCents - a.revenueCents),
        byService: [...byService.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 20),
        byDay: days.map((date) => ({ date, revenueCents: byDay.get(date) ?? 0 })),
      };
    });
  }

  private async names(em: EntityManager, org: OrgContext, ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await em
      .getRepository(Member)
      .createQueryBuilder('m')
      .select(['m.id', 'm.name'])
      .where('m.organizationId = :org AND m.id IN (:...ids)', { org: org.organizationId, ids })
      .getMany();
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private payoutDto(p: CommissionPayout, memberName: string): CommissionPayoutDto {
    return {
      id: p.id,
      memberId: p.memberId,
      memberName,
      commissionsCents: p.commissionsCents,
      advancesCents: p.advancesCents,
      totalCents: p.totalCents,
      entries: p.entries,
      createdAt: p.createdAt.toISOString(),
    };
  }
}

