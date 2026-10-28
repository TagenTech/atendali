import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  Feature,
  formatBRL,
  membershipCanUse,
  membershipState,
  normalizeGiftCode,
  OrderItemKind,
  orderTotals,
  packageExpiry,
  packageStatus,
  pointsEarned,
  redeemable,
  renewMembership,
  sessionsLeft,
  sessionValueCents,
  cycleEnd,
  type IsoDate,
} from '@skedulei/contracts';
import { StockService } from '../estoque/stock.service';
import { Product } from '../estoque/entities/product.entity';
import { ServiceSupply } from '../estoque/entities/service-supply.entity';
import { StockMovement } from '../estoque/entities/stock-movement.entity';
import { ClientPackage, PackageUse } from '../fidelizacao/entities/client-package.entity';
import { GiftCard } from '../fidelizacao/entities/gift-card.entity';
import { LoyaltyEntry } from '../fidelizacao/entities/loyalty-entry.entity';
import { ClientMembership, MembershipPlan, MembershipUse } from '../fidelizacao/entities/membership.entity';
import { PackagePlan } from '../fidelizacao/entities/package-plan.entity';
import { GiftCardsService } from '../fidelizacao/gift-cards.service';
import { loyaltyRule, pointsBalance } from '../fidelizacao/loyalty.service';
import { usedInCycle } from '../fidelizacao/memberships.service';
import { Organization } from '../organizations/entities/organization.entity';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { assertFeature } from '../tenancy/feature-gate';
import { orgToday } from '../tenancy/org-today';
import { OrderItemDto } from './dto/finance.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';

/** Campos de um item já validado e completado, prontos para gravar. */
export interface PreparedItem {
  description: string;
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
  serviceId: string | null;
  refId: string | null;
  refValueCents: number | null;
}

const fmtDate = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

/**
 * Tudo que os itens "especiais" da comanda precisam: pacotes, clube, vale-presente, estoque e pontos.
 * Roda sempre dentro da transação da comanda (mesmo `EntityManager`): ou tudo vale, ou nada.
 */
@Injectable()
export class OrderExtrasService {
  constructor(
    private readonly stock: StockService,
    private readonly gifts: GiftCardsService,
  ) {}

  // ---------------------------------------------------------------- item novo

  async prepareItem(em: EntityManager, org: OrgContext, order: Order, dto: OrderItemDto): Promise<PreparedItem> {
    const orgId = org.organizationId;
    const quantity = dto.quantity ?? 1;
    const discountCents = dto.discountCents ?? 0;
    const need = (cond: unknown, msg: string) => {
      if (!cond) throw new BadRequestException(msg);
    };
    const needClient = () => need(order.clientId, 'Escolha o cliente da comanda antes de adicionar este item');
    const done = (p: Omit<PreparedItem, 'quantity' | 'discountCents'>): PreparedItem => {
      if (discountCents > quantity * p.unitPriceCents) throw new BadRequestException('Desconto maior que o valor do item');
      return { ...p, quantity, discountCents };
    };

    switch (dto.kind) {
      case OrderItemKind.SERVICO: {
        need(dto.serviceId, 'Escolha o serviço');
        const s = await em.getRepository(ServiceItem).findOne({ where: { id: dto.serviceId!, organizationId: orgId } });
        if (!s) throw new NotFoundException('Serviço não encontrado');
        return done({ description: dto.description ?? s.name, unitPriceCents: dto.unitPriceCents ?? s.priceCents, serviceId: s.id, refId: null, refValueCents: null });
      }
      case OrderItemKind.AVULSO:
        need(dto.description && dto.unitPriceCents !== undefined, 'Informe descrição e valor do item');
        return done({ description: dto.description!, unitPriceCents: dto.unitPriceCents!, serviceId: null, refId: null, refValueCents: null });

      case OrderItemKind.PRODUTO: {
        await assertFeature(em, orgId, Feature.ESTOQUE);
        need(dto.refId, 'Escolha o produto');
        const p = await em.getRepository(Product).findOne({ where: { id: dto.refId!, organizationId: orgId } });
        if (!p || !p.active || p.kind !== 'VENDA') throw new NotFoundException('Produto não encontrado');
        const price = dto.unitPriceCents ?? p.salePriceCents;
        need(price !== null && price !== undefined, 'Esse produto não tem preço de venda');
        return done({ description: dto.description ?? p.name, unitPriceCents: price!, serviceId: null, refId: p.id, refValueCents: null });
      }
      case OrderItemKind.PACOTE: {
        await assertFeature(em, orgId, Feature.PACOTES);
        needClient();
        need(dto.refId, 'Escolha o pacote');
        const plan = await em.getRepository(PackagePlan).findOne({ where: { id: dto.refId!, organizationId: orgId } });
        if (!plan?.active) throw new NotFoundException('Pacote não encontrado');
        return done({ description: dto.description ?? `Pacote: ${plan.name}`, unitPriceCents: dto.unitPriceCents ?? plan.priceCents, serviceId: plan.serviceId, refId: plan.id, refValueCents: null });
      }
      case OrderItemKind.CLUBE: {
        await assertFeature(em, orgId, Feature.ASSINATURAS);
        needClient();
        need(dto.refId, 'Escolha o plano');
        need(quantity === 1, 'A mensalidade é uma por vez');
        const plan = await em.getRepository(MembershipPlan).findOne({ where: { id: dto.refId!, organizationId: orgId } });
        if (!plan?.active) throw new NotFoundException('Plano não encontrado');
        const twice = await em.getRepository(OrderItem).exists({ where: { orderId: order.id, organizationId: orgId, kind: OrderItemKind.CLUBE, refId: plan.id } });
        need(!twice, 'Esta comanda já tem a mensalidade desse plano');
        const existing = await this.findMembership(em, orgId, order.clientId!, plan.id);
        if (existing) {
          const today = await orgToday(em, orgId);
          if (!renewMembership(existing, today)) throw new BadRequestException(`A mensalidade está em dia até ${fmtDate(existing.paidThrough!)}`);
        }
        return done({ description: dto.description ?? `Mensalidade: ${plan.name}`, unitPriceCents: dto.unitPriceCents ?? plan.priceCents, serviceId: null, refId: plan.id, refValueCents: null });
      }
      case OrderItemKind.VALE: {
        await assertFeature(em, orgId, Feature.VALES);
        need(dto.unitPriceCents && dto.unitPriceCents > 0, 'Informe o valor do vale');
        return done({ description: dto.description ?? 'Vale-presente', unitPriceCents: dto.unitPriceCents!, serviceId: null, refId: null, refValueCents: null });
      }
      case OrderItemKind.SESSAO_PACOTE: {
        await assertFeature(em, orgId, Feature.PACOTES);
        needClient();
        need(dto.refId, 'Escolha o pacote do cliente');
        need(!dto.discountCents && !dto.unitPriceCents, 'Sessão de pacote não tem valor nem desconto');
        const cp = await em.getRepository(ClientPackage).findOne({ where: { id: dto.refId!, organizationId: orgId, clientId: order.clientId! } });
        if (!cp) throw new NotFoundException('Pacote do cliente não encontrado');
        const today = await orgToday(em, orgId);
        if (packageStatus(cp, today) !== 'ATIVO') throw new BadRequestException('Esse pacote não está mais ativo (sessões usadas ou vencido)');
        const reserved = await this.reserved(em, orgId, OrderItemKind.SESSAO_PACOTE, cp.id);
        if (reserved + quantity > sessionsLeft(cp)) throw new BadRequestException(`O pacote tem ${sessionsLeft(cp)} sessão(ões) e ${reserved} já estão em comandas abertas`);
        return done({ description: `Sessão: ${cp.planName}`, unitPriceCents: 0, serviceId: cp.serviceId, refId: cp.id, refValueCents: sessionValueCents(cp.priceCents, cp.sessionsTotal) });
      }
      case OrderItemKind.SESSAO_CLUBE: {
        await assertFeature(em, orgId, Feature.ASSINATURAS);
        needClient();
        need(dto.refId, 'Escolha a assinatura do cliente');
        need(dto.serviceId, 'Escolha o serviço da sessão');
        need(!dto.discountCents && !dto.unitPriceCents, 'Sessão do clube não tem valor nem desconto');
        const m = await em.getRepository(ClientMembership).findOne({ where: { id: dto.refId!, organizationId: orgId, clientId: order.clientId! } });
        if (!m) throw new NotFoundException('Assinatura não encontrada');
        if (m.serviceId && m.serviceId !== dto.serviceId) throw new BadRequestException('Esse plano do clube não cobre esse serviço');
        const s = await em.getRepository(ServiceItem).findOne({ where: { id: dto.serviceId!, organizationId: orgId } });
        if (!s) throw new NotFoundException('Serviço não encontrado');
        const today = await orgToday(em, orgId);
        const state = membershipState(m, today);
        if (state !== 'EM_DIA') throw new BadRequestException(state === 'VENCIDA' ? 'A mensalidade está vencida. Receba-a antes.' : 'Essa assinatura não está ativa');
        const used = (await usedInCycle(em, orgId, m, today)) + (await this.reserved(em, orgId, OrderItemKind.SESSAO_CLUBE, m.id));
        if (m.sessionsPerMonth !== null && used + quantity > m.sessionsPerMonth) throw new BadRequestException(`O plano permite ${m.sessionsPerMonth} sessão(ões) por mês e já foram usadas ou reservadas ${used}`);
        return done({ description: `Clube: ${s.name}`, unitPriceCents: 0, serviceId: s.id, refId: m.id, refValueCents: s.priceCents });
      }
    }
  }

  // ---------------------------------------------------------------- vale-presente como pagamento

  /** Abate o saldo (travando o vale: dois caixas não gastam o mesmo saldo duas vezes). Devolve o id do vale. */
  async useGiftCard(em: EntityManager, org: OrgContext, code: string | null | undefined, amountCents: number): Promise<string> {
    await assertFeature(em, org.organizationId, Feature.VALES);
    const norm = normalizeGiftCode(code ?? '');
    if (!norm) throw new BadRequestException('Informe o código do vale (XXXX-XXXX-XXXX)');
    const card = await em
      .getRepository(GiftCard)
      .createQueryBuilder('g')
      .setLock('pessimistic_write')
      .where('g.organizationId = :org AND g.code = :code', { org: org.organizationId, code: norm })
      .getOne();
    if (!card) throw new NotFoundException('Vale não encontrado');
    const today = await orgToday(em, org.organizationId);
    if (today > card.expiresAt) throw new BadRequestException(`Vale vencido em ${fmtDate(card.expiresAt)}`);
    if (card.balanceCents <= 0) throw new BadRequestException('Esse vale já foi todo usado');
    if (amountCents > card.balanceCents) throw new BadRequestException(`O vale tem só ${formatBRL(card.balanceCents)} de saldo`);
    await em.getRepository(GiftCard).update({ id: card.id, organizationId: org.organizationId }, { balanceCents: card.balanceCents - amountCents });
    return card.id;
  }

  async restoreGiftCard(em: EntityManager, organizationId: string, cardId: string | null, amountCents: number): Promise<void> {
    if (!cardId) return;
    await em
      .getRepository(GiftCard)
      .createQueryBuilder()
      .update()
      .set({ balanceCents: () => `balance_cents + ${Math.trunc(amountCents)}` })
      .where('id = :id AND organization_id = :org', { id: cardId, org: organizationId })
      .execute();
  }

  // ---------------------------------------------------------------- resgate de pontos

  /** Gasta `points` nesta comanda (0 desfaz). Limitado ao saldo, a múltiplos de um resgate e ao valor da conta. */
  async redeem(em: EntityManager, org: OrgContext, order: Order, points: number): Promise<void> {
    const { rule, active } = await loyaltyRule(em, org.organizationId);
    if (!active) throw new BadRequestException('O programa de fidelidade está desligado');
    if (!order.clientId) throw new BadRequestException('Escolha o cliente da comanda para usar pontos');
    const items = await em.getRepository(OrderItem).find({ where: { orderId: order.id, organizationId: org.organizationId } });
    const before = orderTotals(items, order.discountCents, []).totalCents;
    // O que o cliente tem de verdade: o saldo atual + o que esta comanda já reservou.
    const balance = (await pointsBalance(em, org.organizationId, order.clientId)) + order.pointsRedeemed;
    const allowed = redeemable(balance, rule, before);
    if (points % rule.redeemPoints !== 0) throw new BadRequestException(`Os pontos são trocados de ${rule.redeemPoints} em ${rule.redeemPoints}`);
    if (points > allowed.points) throw new BadRequestException(allowed.points ? `Você pode usar até ${allowed.points} pontos nesta comanda` : 'Sem pontos suficientes para resgatar');
    await em.getRepository(LoyaltyEntry).delete({ organizationId: org.organizationId, orderId: order.id, reason: 'RESGATE' });
    if (points > 0) {
      await em.getRepository(LoyaltyEntry).insert({ organizationId: org.organizationId, clientId: order.clientId, points: -points, reason: 'RESGATE', orderId: order.id, note: null });
    }
    order.pointsRedeemed = points;
    order.pointsDiscountCents = (points / rule.redeemPoints) * rule.redeemValueCents;
    await em.getRepository(Order).update({ id: order.id, organizationId: org.organizationId }, { pointsRedeemed: order.pointsRedeemed, pointsDiscountCents: order.pointsDiscountCents });
  }

  /** Itens ou desconto mudaram: se o resgate passou a valer mais que a conta, reduz até caber. */
  async reconcileRedeem(em: EntityManager, org: OrgContext, order: Order): Promise<void> {
    if (!order.pointsRedeemed) return;
    const { rule } = await loyaltyRule(em, org.organizationId);
    const items = await em.getRepository(OrderItem).find({ where: { orderId: order.id, organizationId: org.organizationId } });
    const cap = redeemable(order.pointsRedeemed, rule, orderTotals(items, order.discountCents, []).totalCents);
    if (cap.points !== order.pointsRedeemed) await this.redeem(em, org, order, cap.points);
  }

  // ---------------------------------------------------------------- fechamento

  /** Efeitos do fechamento: pacotes, clube, vales, baixa de estoque e pontos. `itemNet` = valor líquido de cada item. */
  async onClose(em: EntityManager, org: OrgContext, order: Order, items: OrderItem[], itemNet: number[], totalCents: number): Promise<void> {
    const orgId = org.organizationId;
    const today = await orgToday(em, orgId);
    const orgRow = await em.getRepository(Organization).findOneOrFail({ where: { id: orgId }, select: { id: true, features: true } });
    const useStock = orgRow.features.includes(Feature.ESTOQUE);

    for (const [k, item] of items.entries()) {
      switch (item.kind) {
        case OrderItemKind.PRODUTO:
          if (item.refId) await this.stock.apply(em, { organizationId: orgId, productId: item.refId, kind: 'VENDA', quantity: item.quantity, orderId: order.id, orderItemId: item.id, memberId: item.memberId });
          break;

        case OrderItemKind.PACOTE: {
          const plan = await em.getRepository(PackagePlan).findOneByOrFail({ id: item.refId!, organizationId: orgId });
          const price = Math.round(itemNet[k] / item.quantity);
          for (let n = 0; n < item.quantity; n++) {
            await em.getRepository(ClientPackage).insert({
              organizationId: orgId,
              clientId: order.clientId!,
              planId: plan.id,
              planName: plan.name,
              serviceId: plan.serviceId,
              sessionsTotal: plan.sessions,
              sessionsUsed: 0,
              priceCents: price,
              purchasedAt: today,
              expiresAt: packageExpiry(today, plan.validityDays),
              soldOrderItemId: item.id,
            });
          }
          break;
        }

        case OrderItemKind.SESSAO_PACOTE: {
          const cp = await em
            .getRepository(ClientPackage)
            .createQueryBuilder('c')
            .setLock('pessimistic_write')
            .where('c.id = :id AND c.organizationId = :org', { id: item.refId, org: orgId })
            .getOneOrFail();
          if (packageStatus(cp, today) !== 'ATIVO' || sessionsLeft(cp) < item.quantity) throw new BadRequestException(`O pacote "${cp.planName}" não tem mais sessões suficientes`);
          await em.getRepository(ClientPackage).update({ id: cp.id, organizationId: orgId }, { sessionsUsed: cp.sessionsUsed + item.quantity });
          await em.getRepository(PackageUse).insert({ organizationId: orgId, clientPackageId: cp.id, orderItemId: item.id, quantity: item.quantity });
          break;
        }

        case OrderItemKind.CLUBE: {
          const plan = await em.getRepository(MembershipPlan).findOneByOrFail({ id: item.refId!, organizationId: orgId });
          let m = await this.findMembership(em, orgId, order.clientId!, plan.id);
          if (m) await em.getRepository(ClientMembership).createQueryBuilder('x').setLock('pessimistic_write').where('x.id = :id', { id: m.id }).getOne();
          const fresh = m ?? em.getRepository(ClientMembership).create({
            organizationId: orgId,
            clientId: order.clientId!,
            planId: plan.id,
            planName: plan.name,
            priceCents: plan.priceCents,
            serviceId: plan.serviceId,
            sessionsPerMonth: plan.sessionsPerMonth,
            status: 'ATIVA',
            anchor: null,
            cyclesPaid: 0,
            paidThrough: null,
            createdOrderItemId: item.id,
            lastOrderItemId: null,
          });
          const r = renewMembership(fresh, today);
          if (!r) throw new BadRequestException('A mensalidade já está em dia');
          Object.assign(fresh, { ...r, status: 'ATIVA', lastOrderItemId: item.id });
          m = await em.getRepository(ClientMembership).save(fresh);
          break;
        }

        case OrderItemKind.SESSAO_CLUBE: {
          const m = await em
            .getRepository(ClientMembership)
            .createQueryBuilder('m')
            .setLock('pessimistic_write')
            .where('m.id = :id AND m.organizationId = :org', { id: item.refId, org: orgId })
            .getOneOrFail();
          const state = membershipState(m, today);
          const used = await usedInCycle(em, orgId, m, today);
          if (!membershipCanUse(state, m.sessionsPerMonth, used + item.quantity - 1)) {
            throw new BadRequestException(`A assinatura "${m.planName}" não cobre mais esta sessão (mensalidade vencida ou limite do mês atingido)`);
          }
          await em.getRepository(MembershipUse).insert({ organizationId: orgId, membershipId: m.id, orderItemId: item.id, quantity: item.quantity, usedDate: today });
          break;
        }

        case OrderItemKind.VALE:
          for (let n = 0; n < item.quantity; n++) {
            await this.gifts.issue(em, { organizationId: orgId, amountCents: item.unitPriceCents, orderId: order.id, orderItemId: item.id, buyerClientId: order.clientId, today });
          }
          break;
      }

      // Ficha técnica: serviço feito (ou sessão de pacote/clube) consome insumos.
      if (useStock && item.serviceId && (item.kind === OrderItemKind.SERVICO || item.kind === OrderItemKind.SESSAO_PACOTE || item.kind === OrderItemKind.SESSAO_CLUBE)) {
        const supplies = await em.getRepository(ServiceSupply).find({ where: { serviceId: item.serviceId, organizationId: orgId } });
        for (const s of supplies) {
          await this.stock.apply(em, { organizationId: orgId, productId: s.productId, kind: 'CONSUMO', quantity: s.quantity * item.quantity, orderId: order.id, orderItemId: item.id, memberId: item.memberId });
        }
      }
    }

    // Pontos: sobre o valor da conta, sem a venda de vales (que ainda não é consumo).
    const { rule, active } = await loyaltyRule(em, orgId);
    if (active && order.clientId) {
      const valeNet = items.reduce((s, i, k) => (i.kind === OrderItemKind.VALE ? s + itemNet[k] : s), 0);
      const points = pointsEarned(totalCents - valeNet, rule);
      if (points > 0) await em.getRepository(LoyaltyEntry).insert({ organizationId: orgId, clientId: order.clientId, points, reason: 'GANHO', orderId: order.id, note: null });
    }
  }

  // ---------------------------------------------------------------- estorno

  /**
   * Desfaz os efeitos de uma comanda paga (e devolve o saldo dos vales usados). Recusa o que não dá para
   * desfazer com segurança: pacote já usado, vale já gasto, mensalidade que não é a última.
   */
  async onReverse(em: EntityManager, org: OrgContext, order: Order, items: OrderItem[], giftPayments: { refId: string | null; amountCents: number }[], wasClosed: boolean): Promise<void> {
    const orgId = org.organizationId;
    for (const p of giftPayments) await this.restoreGiftCard(em, orgId, p.refId, p.amountCents);
    await em.getRepository(LoyaltyEntry).delete({ organizationId: orgId, orderId: order.id });
    if (!wasClosed) return;

    for (const item of items) {
      switch (item.kind) {
        case OrderItemKind.PACOTE: {
          const sold = await em.getRepository(ClientPackage).find({ where: { organizationId: orgId, soldOrderItemId: item.id } });
          if (sold.some((c) => c.sessionsUsed > 0)) throw new BadRequestException('O pacote vendido nesta comanda já foi usado. Não dá para estornar.');
          if (sold.length) await em.getRepository(ClientPackage).delete({ id: In(sold.map((c) => c.id)), organizationId: orgId });
          break;
        }
        case OrderItemKind.SESSAO_PACOTE: {
          const use = await em.getRepository(PackageUse).findOne({ where: { orderItemId: item.id, organizationId: orgId } });
          if (use) {
            await em
              .getRepository(ClientPackage)
              .createQueryBuilder()
              .update()
              .set({ sessionsUsed: () => `GREATEST(sessions_used - ${Math.trunc(use.quantity)}, 0)` })
              .where('id = :id AND organization_id = :org', { id: use.clientPackageId, org: orgId })
              .execute();
            await em.getRepository(PackageUse).delete({ id: use.id, organizationId: orgId });
          }
          break;
        }
        case OrderItemKind.SESSAO_CLUBE:
          await em.getRepository(MembershipUse).delete({ orderItemId: item.id, organizationId: orgId });
          break;
        case OrderItemKind.CLUBE: {
          const m = await em.getRepository(ClientMembership).findOne({ where: { organizationId: orgId, createdOrderItemId: item.id } }) ?? (await em.getRepository(ClientMembership).findOne({ where: { organizationId: orgId, lastOrderItemId: item.id } }));
          if (!m) break;
          if (m.lastOrderItemId !== item.id) throw new BadRequestException('Só dá para estornar a última mensalidade desta assinatura.');
          if (m.cyclesPaid > 1) {
            const cycles = m.cyclesPaid - 1;
            const through = cycleEnd(m.anchor!, cycles);
            await em.getRepository(ClientMembership).update({ id: m.id, organizationId: orgId }, { cyclesPaid: cycles, paidThrough: through, lastOrderItemId: null });
          } else if (m.createdOrderItemId === item.id && !(await em.getRepository(MembershipUse).exists({ where: { membershipId: m.id, organizationId: orgId } }))) {
            await em.getRepository(ClientMembership).delete({ id: m.id, organizationId: orgId });
          } else {
            throw new BadRequestException('Essa mensalidade recomeçou a assinatura e já teve uso. Cancele a assinatura em vez de estornar.');
          }
          break;
        }
        case OrderItemKind.VALE: {
          const cards = await em.getRepository(GiftCard).find({ where: { organizationId: orgId, orderItemId: item.id } });
          if (cards.some((c) => c.balanceCents !== c.initialCents)) throw new BadRequestException('O vale vendido nesta comanda já foi usado. Não dá para estornar.');
          if (cards.length) await em.getRepository(GiftCard).delete({ id: In(cards.map((c) => c.id)), organizationId: orgId });
          break;
        }
      }
    }

    // Estoque: devolve exatamente o que saiu desta comanda.
    const out = await em.getRepository(StockMovement).find({ where: { organizationId: orgId, orderId: order.id, kind: In(['VENDA', 'CONSUMO']) } });
    for (const m of out) {
      await this.stock.apply(em, { organizationId: orgId, productId: m.productId, kind: 'ESTORNO', quantity: Math.abs(m.quantity), orderId: order.id, orderItemId: m.orderItemId, note: `Estorno da comanda #${order.number}` });
    }
  }

  // ---------------------------------------------------------------- utilitários

  private findMembership(em: EntityManager, organizationId: string, clientId: string, planId: string) {
    return em.getRepository(ClientMembership).findOne({ where: { organizationId, clientId, planId, status: In(['ATIVA', 'PAUSADA']) }, order: { createdAt: 'DESC' } });
  }

  /** Quantidade já "reservada" por itens de comandas abertas (evita gastar a mesma sessão em duas comandas). */
  private async reserved(em: EntityManager, organizationId: string, kind: string, refId: string): Promise<number> {
    const row = await em
      .getRepository(OrderItem)
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .select('COALESCE(SUM(i.quantity), 0)', 'n')
      .where('i.organizationId = :organizationId AND i.kind = :kind AND i.refId = :refId', { organizationId, kind, refId })
      .andWhere("o.status = 'ABERTA'")
      .getRawOne<{ n: string }>();
    return Number(row?.n ?? 0);
  }
}
