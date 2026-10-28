import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Feature, loyaltyOf, type LoyaltyBalanceDto, type LoyaltyRule } from '@agendei/contracts';
import { Client } from '../agenda/entities/client.entity';
import { Order } from '../financeiro/entities/order.entity';
import { Organization } from '../organizations/entities/organization.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { AdjustPointsDto } from './dto/retention.dto';
import { LoyaltyEntry } from './entities/loyalty-entry.entity';

/** Regra de fidelidade do negócio; `active` só quando o módulo está ligado E a regra habilitada. */
export async function loyaltyRule(em: EntityManager, organizationId: string): Promise<{ rule: LoyaltyRule; active: boolean }> {
  const org = await em.getRepository(Organization).findOneOrFail({ where: { id: organizationId }, select: { id: true, features: true, loyalty: true } });
  const rule = loyaltyOf(org.loyalty);
  return { rule, active: org.features.includes(Feature.FIDELIDADE) && rule.enabled };
}

export async function pointsBalance(em: EntityManager, organizationId: string, clientId: string): Promise<number> {
  const row = await em
    .getRepository(LoyaltyEntry)
    .createQueryBuilder('e')
    .select('COALESCE(SUM(e.points), 0)', 'n')
    .where('e.organizationId = :organizationId AND e.clientId = :clientId', { organizationId, clientId })
    .getRawOne<{ n: string }>();
  return Number(row?.n ?? 0);
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly tenant: TenantDb) {}

  /** Saldo e extrato do cliente. Com o módulo desligado devolve `enabled: false` (a ficha do cliente não quebra). */
  async balance(org: OrgContext, clientId: string): Promise<LoyaltyBalanceDto> {
    return this.tenant.transaction(async (em) => {
      if (!(await em.getRepository(Client).exists({ where: { id: clientId, organizationId: org.organizationId } }))) throw new NotFoundException('Cliente não encontrado');
      const { rule, active } = await loyaltyRule(em, org.organizationId);
      if (!active) return { enabled: false, rule, balance: 0, entries: [] };
      const entries = await em.getRepository(LoyaltyEntry).find({ where: { organizationId: org.organizationId, clientId }, order: { createdAt: 'DESC' }, take: 50 });
      const numbers = new Map<string, number>();
      const ids = [...new Set(entries.map((e) => e.orderId).filter((x): x is string => !!x))];
      for (const id of ids) {
        const o = await em.getRepository(Order).findOne({ where: { id, organizationId: org.organizationId }, select: { id: true, number: true } });
        if (o) numbers.set(id, o.number);
      }
      return {
        enabled: true,
        rule,
        balance: await pointsBalance(em, org.organizationId, clientId),
        entries: entries.map((e) => ({
          id: e.id,
          points: e.points,
          reason: e.note ?? (e.reason === 'GANHO' ? 'Compra' : e.reason === 'RESGATE' ? 'Resgate' : 'Ajuste'),
          orderNumber: e.orderId ? (numbers.get(e.orderId) ?? null) : null,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    });
  }

  /** Ajuste manual (cortesia, correção). Não deixa o saldo ficar negativo. */
  async adjust(org: OrgContext, clientId: string, dto: AdjustPointsDto): Promise<LoyaltyBalanceDto> {
    await this.tenant.transaction(async (em) => {
      const { active } = await loyaltyRule(em, org.organizationId);
      if (!active) throw new BadRequestException('O programa de fidelidade está desligado');
      if (!(await em.getRepository(Client).exists({ where: { id: clientId, organizationId: org.organizationId } }))) throw new NotFoundException('Cliente não encontrado');
      if (dto.points === 0) throw new BadRequestException('Informe quantos pontos');
      if ((await pointsBalance(em, org.organizationId, clientId)) + dto.points < 0) throw new BadRequestException('O saldo não pode ficar negativo');
      await em.getRepository(LoyaltyEntry).insert({ organizationId: org.organizationId, clientId, points: dto.points, reason: 'AJUSTE', orderId: null, note: dto.note });
    });
    return this.balance(org, clientId);
  }
}
