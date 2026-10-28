import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { EntityManager, In } from 'typeorm';
import {
  addDays,
  Feature,
  generateGiftCode,
  GIFT_VALIDITY_DAYS,
  giftCardStatus,
  normalizeGiftCode,
  type GiftCardDto,
  type IsoDate,
} from '@agendei/contracts';
import { Order } from '../financeiro/entities/order.entity';
import type { OrgContext } from '../organizations/org-context';
import { assertFeature } from '../tenancy/feature-gate';
import { orgToday } from '../tenancy/org-today';
import { TenantDb } from '../tenancy/tenant-db';
import { GiftCard } from './entities/gift-card.entity';

export const toGiftDto = (g: GiftCard, today: IsoDate, orderNumber: number | null, buyerName: string | null): GiftCardDto => ({
  id: g.id,
  code: g.code,
  initialCents: g.initialCents,
  balanceCents: g.balanceCents,
  expiresAt: g.expiresAt,
  status: giftCardStatus(g, today),
  buyerName,
  orderNumber,
  createdAt: g.createdAt.toISOString(),
});

@Injectable()
export class GiftCardsService {
  constructor(private readonly tenant: TenantDb) {}

  private gate(em: EntityManager, org: OrgContext) {
    return assertFeature(em, org.organizationId, Feature.VALES);
  }

  async list(org: OrgContext): Promise<GiftCardDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const today = await orgToday(em, org.organizationId);
      const rows = await em.getRepository(GiftCard).find({ where: { organizationId: org.organizationId }, order: { createdAt: 'DESC' }, take: 200 });
      return this.withExtras(em, org.organizationId, rows, today);
    });
  }

  /** Consulta pelo código (balcão): aceita minúsculas e sem hífens. */
  async lookup(org: OrgContext, code: string): Promise<GiftCardDto> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const norm = normalizeGiftCode(code);
      if (!norm) throw new BadRequestException('Código inválido. São 12 letras e números (XXXX-XXXX-XXXX).');
      const g = await em.getRepository(GiftCard).findOne({ where: { organizationId: org.organizationId, code: norm } });
      if (!g) throw new NotFoundException('Vale não encontrado');
      const today = await orgToday(em, org.organizationId);
      return (await this.withExtras(em, org.organizationId, [g], today))[0];
    });
  }

  /** Emite um vale (no fechamento da comanda que o vendeu). Código único por negócio. */
  async issue(em: EntityManager, p: { organizationId: string; amountCents: number; orderId: string; orderItemId: string; buyerClientId: string | null; today: IsoDate }): Promise<GiftCard> {
    const repo = em.getRepository(GiftCard);
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateGiftCode((n) => randomInt(n));
      if (await repo.exists({ where: { organizationId: p.organizationId, code } })) continue;
      return repo.save(
        repo.create({
          organizationId: p.organizationId,
          code,
          initialCents: p.amountCents,
          balanceCents: p.amountCents,
          expiresAt: addDays(p.today, GIFT_VALIDITY_DAYS),
          orderId: p.orderId,
          orderItemId: p.orderItemId,
          buyerClientId: p.buyerClientId,
        }),
      );
    }
    throw new BadRequestException('Não foi possível gerar o código do vale. Tente de novo.');
  }

  private async withExtras(em: EntityManager, organizationId: string, rows: GiftCard[], today: IsoDate): Promise<GiftCardDto[]> {
    const orderIds = [...new Set(rows.map((r) => r.orderId).filter((x): x is string => !!x))];
    const orders = orderIds.length ? await em.getRepository(Order).find({ where: { id: In(orderIds), organizationId }, relations: { client: true } }) : [];
    const byOrder = new Map(orders.map((o) => [o.id, o]));
    return rows.map((g) => {
      const o = g.orderId ? byOrder.get(g.orderId) : undefined;
      return toGiftDto(g, today, o?.number ?? null, o?.client?.name ?? null);
    });
  }
}
