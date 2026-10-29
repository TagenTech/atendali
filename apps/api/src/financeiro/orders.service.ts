import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, In, IsNull, Not } from 'typeorm';
import {
  addDays,
  AppointmentStatus,
  commissionRate,
  commissionsFor,
  OrderItemKind,
  OrderStatus,
  PaymentMethod,
  orderTotals,
  paymentFee,
  formatBRL,
  PAYMENT_METHOD_LABEL,
  paymentMethodsOf,
  settlementDate,
  todayIn,
  zonedToUtc,
  type OrderDto,
  type OrderSummaryDto,
} from '@skedulei/contracts';
import { Appointment } from '../agenda/entities/appointment.entity';
import { Client } from '../agenda/entities/client.entity';
import { Member } from '../organizations/entities/member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { AuditService } from '../auditoria/audit.service';
import { CashService, mainUnit } from './cash.service';
import { AddPaymentDto, CreateOrderDto, OrderItemDto, OrdersQueryDto, UpdateOrderDto } from './dto/finance.dto';
import { CommissionEntry } from './entities/commission.entity';
import { CashSession } from './entities/cash-session.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { Order } from './entities/order.entity';
import { LedgerService } from './ledger.service';
import { OrderExtrasService } from './order-extras.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly cash: CashService,
    private readonly ledger: LedgerService,
    private readonly extras: OrderExtrasService,
    private readonly audit: AuditService,
  ) {}

  async list(org: OrgContext, q: OrdersQueryDto): Promise<OrderSummaryDto[]> {
    return this.tenant.transaction(async (em) => {
      const unit = await mainUnit(em, org.organizationId);
      const where: Record<string, unknown> = { organizationId: org.organizationId };
      if (q.status) where.status = q.status;
      if (q.date) where.closedAt = Between(zonedToUtc(q.date, '00:00', unit.timezone), zonedToUtc(addDays(q.date, 1), '00:00', unit.timezone));
      const orders = await em.getRepository(Order).find({ where, relations: { client: true }, order: { number: 'DESC' }, take: 100 });
      if (!orders.length) return [];
      const ids = orders.map((o) => o.id);
      const [items, payments] = await Promise.all([
        em.getRepository(OrderItem).find({ where: { orderId: In(ids), organizationId: org.organizationId } }),
        em.getRepository(OrderPayment).find({ where: { orderId: In(ids), organizationId: org.organizationId } }),
      ]);
      return orders.map((o) => {
        const t = orderTotals(items.filter((i) => i.orderId === o.id), o.totalDiscountCents, payments.filter((p) => p.orderId === o.id));
        return {
          id: o.id,
          number: o.number,
          status: o.status,
          clientName: o.client?.name ?? null,
          totalCents: t.totalCents,
          paidCents: t.paidCents,
          openedAt: o.openedAt.toISOString(),
          closedAt: o.closedAt?.toISOString() ?? null,
        };
      });
    });
  }

  /** Abre comanda (vazia, de um cliente, ou já com os serviços de agendamentos — o check-in). */
  async create(org: OrgContext, dto: CreateOrderDto): Promise<OrderDto> {
    const id = await this.tenant.transaction(async (em) => {
      const unit = await mainUnit(em, org.organizationId);
      let clientId = dto.clientId ?? null;
      const appts = dto.appointmentIds?.length
        ? await em.getRepository(Appointment).find({
            where: { id: In(dto.appointmentIds), organizationId: org.organizationId },
            relations: { service: true },
          })
        : [];
      if (appts.length !== (dto.appointmentIds?.length ?? 0)) throw new NotFoundException('Agendamento não encontrado');
      if (appts.some((a) => a.status === AppointmentStatus.CANCELADO)) throw new BadRequestException('Agendamento cancelado não vai para comanda');
      if (appts.length) {
        const taken = await em
          .getRepository(OrderItem)
          .createQueryBuilder('i')
          .innerJoin('i.order', 'o')
          .where('i.appointmentId IN (:...ids)', { ids: appts.map((a) => a.id) })
          .andWhere('o.status <> :c', { c: OrderStatus.CANCELADA })
          .getCount();
        if (taken) throw new ConflictException('Esse atendimento já está em uma comanda');
        clientId ??= appts[0].clientId;
      }
      if (clientId && !(await em.getRepository(Client).exists({ where: { id: clientId, organizationId: org.organizationId } }))) {
        throw new NotFoundException('Cliente não encontrado');
      }

      const seq = await em
        .getRepository(Organization)
        .createQueryBuilder()
        .update()
        .set({ orderSeq: () => 'order_seq + 1' })
        .where('id = :id', { id: org.organizationId })
        .returning('order_seq')
        .execute();
      const order = await em.getRepository(Order).save(
        em.getRepository(Order).create({
          organizationId: org.organizationId,
          unitId: unit.id,
          number: Number(seq.raw[0].order_seq),
          status: OrderStatus.ABERTA,
          clientId,
          discountCents: 0,
          notes: null,
          openedByMemberId: org.memberId,
        }),
      );
      for (const a of appts) {
        await em.getRepository(OrderItem).insert({
          organizationId: org.organizationId,
          orderId: order.id,
          kind: OrderItemKind.SERVICO,
          serviceId: a.serviceId,
          appointmentId: a.id,
          memberId: a.memberId,
          description: a.service.name,
          quantity: 1,
          unitPriceCents: a.priceCents,
          discountCents: 0,
        });
        if (a.status === AppointmentStatus.AGENDADO || a.status === AppointmentStatus.CONFIRMADO) {
          await em.getRepository(Appointment).update({ id: a.id, organizationId: org.organizationId }, { status: AppointmentStatus.CHEGOU });
        }
      }
      return order.id;
    });
    return this.get(org, id);
  }

  async get(org: OrgContext, id: string): Promise<OrderDto> {
    return this.tenant.transaction(async (em) => {
      const o = await this.find(em, org, id);
      const [items, payments] = await Promise.all([
        em.getRepository(OrderItem).find({ where: { orderId: o.id, organizationId: org.organizationId }, relations: { member: true }, order: { createdAt: 'ASC' } }),
        em.getRepository(OrderPayment).find({ where: { orderId: o.id, organizationId: org.organizationId }, order: { createdAt: 'ASC' } }),
      ]);
      const t = orderTotals(items, o.totalDiscountCents, payments);
      const { itemNetCents, ...totals } = t;
      return {
        id: o.id,
        number: o.number,
        status: o.status,
        clientId: o.clientId,
        clientName: o.client?.name ?? null,
        items: items.map((i, k) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          serviceId: i.serviceId,
          memberId: i.memberId,
          memberName: i.member?.name ?? null,
          appointmentId: i.appointmentId,
          refId: i.refId,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          discountCents: i.discountCents,
          netCents: itemNetCents[k],
        })),
        payments: payments.map((p) => ({ id: p.id, method: p.method, amountCents: p.amountCents, feeCents: p.feeCents, createdAt: p.createdAt.toISOString() })),
        discountCents: o.discountCents,
        loyalty: { redeemedPoints: o.pointsRedeemed, discountCents: o.pointsDiscountCents },
        totals: { ...totals, feesCents: payments.reduce((s, p) => s + p.feeCents, 0) },
        notes: o.notes,
        openedAt: o.openedAt.toISOString(),
        closedAt: o.closedAt?.toISOString() ?? null,
      };
    });
  }

  async update(org: OrgContext, id: string, dto: UpdateOrderDto): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      if (dto.clientId !== undefined) {
        if (dto.clientId && !(await em.getRepository(Client).exists({ where: { id: dto.clientId, organizationId: org.organizationId } }))) {
          throw new NotFoundException('Cliente não encontrado');
        }
        // `client` vem carregado: é ele que o TypeORM grava, então trocamos os dois (senão a troca não pega).
        o.clientId = dto.clientId;
        o.client = dto.clientId ? ({ id: dto.clientId } as Client) : null;
      }
      const discountBefore = o.discountCents;
      if (dto.discountCents !== undefined) o.discountCents = dto.discountCents;
      if (dto.notes !== undefined) o.notes = dto.notes;
      await em.getRepository(Order).save(o);
      if (dto.discountCents !== undefined && dto.discountCents !== discountBefore) {
        await this.audit.log(em, org, { action: 'ORDER_DISCOUNT', entity: 'order', entityId: o.id, summary: `Desconto da comanda #${o.number}: de ${formatBRL(discountBefore)} para ${formatBRL(dto.discountCents)}`, meta: { from: discountBefore, to: dto.discountCents } });
      }
      await this.extras.reconcileRedeem(em, org, o);
      await this.assertNotOverpaid(em, org, o);
    });
    return this.get(org, id);
  }

  async addItem(org: OrgContext, id: string, dto: OrderItemDto): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      if (dto.memberId && !(await em.getRepository(Member).exists({ where: { id: dto.memberId, organizationId: org.organizationId } }))) {
        throw new NotFoundException('Profissional não encontrado');
      }
      const item = await this.extras.prepareItem(em, org, o, dto);
      await em.getRepository(OrderItem).insert({
        organizationId: org.organizationId,
        orderId: o.id,
        kind: dto.kind,
        serviceId: item.serviceId,
        refId: item.refId,
        refValueCents: item.refValueCents,
        appointmentId: null,
        memberId: dto.memberId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents,
      });
    });
    return this.get(org, id);
  }

  async removeItem(org: OrgContext, id: string, itemId: string): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      const item = await em.getRepository(OrderItem).findOne({ where: { id: itemId, orderId: o.id, organizationId: org.organizationId } });
      if (!item) throw new NotFoundException('Item não encontrado');
      await em.getRepository(OrderItem).delete({ id: itemId, orderId: o.id, organizationId: org.organizationId });
      await this.audit.log(em, org, { action: 'ORDER_ITEM_REMOVED', entity: 'order', entityId: o.id, summary: `Item "${item.description}" (${formatBRL(item.unitPriceCents * item.quantity)}) removido da comanda #${o.number}`, meta: { itemId } });
      await this.extras.reconcileRedeem(em, org, o);
      await this.assertNotOverpaid(em, org, o);
    });
    return this.get(org, id);
  }

  /** Recebe (parcial ou total) — precisa de caixa aberto; não aceita mais do que falta. Vale-presente abate o saldo do vale. */
  async addPayment(org: OrgContext, id: string, dto: AddPaymentDto): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      const session = await this.cash.requireOpen(em, org);
      const gift = dto.method === PaymentMethod.VALE_PRESENTE;
      const cfg = gift ? null : paymentMethodsOf((await em.getRepository(Organization).findOneByOrFail({ id: org.organizationId })).paymentMethods).find((m) => m.method === dto.method)!;
      if (cfg && !cfg.enabled) throw new BadRequestException('Essa forma de pagamento está desligada');
      const t = await this.totals(em, org, o);
      if (t.dueCents <= 0) throw new BadRequestException('A comanda já está paga');
      if (dto.amountCents > t.dueCents) throw new BadRequestException('Valor maior do que falta pagar (dê o troco do dinheiro)');
      const refId = gift ? await this.extras.useGiftCard(em, org, dto.giftCode, dto.amountCents) : null;
      const feeCents = cfg ? paymentFee(dto.amountCents, cfg) : 0;
      const ins = await em.getRepository(OrderPayment).insert({
        organizationId: org.organizationId,
        orderId: o.id,
        cashSessionId: session.id,
        method: dto.method,
        refId,
        amountCents: dto.amountCents,
        feeCents,
        memberId: org.memberId,
      });
      // Vale-presente não gera dinheiro a receber. Os demais: cai em pagamento + D+N da forma de pagamento.
      if (cfg) {
        const paidOn = todayIn((await mainUnit(em, org.organizationId)).timezone);
        await this.ledger.fromOrderPayment(em, {
          organizationId: org.organizationId,
          paymentId: ins.identifiers[0].id as string,
          orderNumber: o.number,
          method: dto.method,
          amountCents: dto.amountCents,
          feeCents,
          paidOn,
          expectedDate: settlementDate(paidOn, cfg.settlementDays),
          label: `Comanda #${o.number} · ${PAYMENT_METHOD_LABEL[dto.method]}`,
        });
      }
    });
    return this.get(org, id);
  }

  async removePayment(org: OrgContext, id: string, paymentId: string): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      const p = await em.getRepository(OrderPayment).findOne({ where: { id: paymentId, orderId: o.id, organizationId: org.organizationId } });
      if (!p) throw new NotFoundException('Pagamento não encontrado');
      await this.assertSessionOpen(em, org, [p.cashSessionId]);
      if (p.method === PaymentMethod.VALE_PRESENTE) await this.extras.restoreGiftCard(em, org.organizationId, p.refId, p.amountCents);
      await em.getRepository(OrderPayment).delete({ id: p.id, organizationId: org.organizationId });
      await this.audit.log(em, org, { action: 'PAYMENT_REMOVED', entity: 'order', entityId: o.id, summary: `Pagamento de ${formatBRL(p.amountCents)} (${PAYMENT_METHOD_LABEL[p.method]}) desfeito na comanda #${o.number}`, meta: { paymentId: p.id, method: p.method, amountCents: p.amountCents } });
    });
    return this.get(org, id);
  }

  /** Fecha a comanda quitada: gera as comissões e conclui os atendimentos. */
  async close(org: OrgContext, id: string): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      const items = await em.getRepository(OrderItem).find({ where: { orderId: o.id, organizationId: org.organizationId }, order: { createdAt: 'ASC' } });
      if (!items.length) throw new BadRequestException('A comanda está vazia');
      const payments = await em.getRepository(OrderPayment).find({ where: { orderId: o.id, organizationId: org.organizationId } });
      const t = orderTotals(items, o.totalDiscountCents, payments);
      if (t.dueCents > 0) throw new BadRequestException('Ainda falta receber');

      const orgRow = await em.getRepository(Organization).findOneByOrFail({ id: org.organizationId });
      const memberIds = [...new Set(items.map((i) => i.memberId).filter((x): x is string => !!x))];
      const serviceIds = [...new Set(items.map((i) => i.serviceId).filter((x): x is string => !!x))];
      const [members, services] = await Promise.all([
        memberIds.length ? em.getRepository(Member).find({ where: { id: In(memberIds), organizationId: org.organizationId } }) : [],
        serviceIds.length ? em.getRepository(ServiceItem).find({ where: { id: In(serviceIds), organizationId: org.organizationId } }) : [],
      ]);
      const rates = items.map((i) =>
        commissionRate(services.find((s) => s.id === i.serviceId)?.commissionBps, members.find((m) => m.id === i.memberId)?.commissionBps),
      );
      const commissions = commissionsFor(
        items.map((i, k) => ({ netCents: t.itemNetCents[k], bps: rates[k], memberId: i.memberId })),
        orgRow.commissionBase,
        payments.reduce((s, p) => s + p.feeCents, 0),
      );
      // Sessão de pacote/clube vale zero na comanda: a comissão sai do valor de referência. Vale-presente não comissiona.
      items.forEach((i, k) => {
        if (i.kind === OrderItemKind.VALE) commissions[k] = { baseCents: 0, amountCents: 0 };
        else if (i.refValueCents && i.memberId) {
          const baseCents = i.refValueCents * i.quantity;
          commissions[k] = { baseCents, amountCents: Math.round((baseCents * rates[k]) / 10_000) };
        }
      });
      const entries = items
        .map((i, k) => ({ i, k }))
        .filter(({ i, k }) => i.memberId && commissions[k].amountCents > 0)
        .map(({ i, k }) => ({
          organizationId: org.organizationId,
          memberId: i.memberId!,
          orderId: o.id,
          orderItemId: i.id,
          description: i.description,
          baseCents: commissions[k].baseCents,
          bps: rates[k],
          amountCents: commissions[k].amountCents,
          payoutId: null,
        }));
      if (entries.length) await em.getRepository(CommissionEntry).insert(entries);
      await this.extras.onClose(em, org, o, items, t.itemNetCents, t.totalCents);

      const apptIds = items.map((i) => i.appointmentId).filter((x): x is string => !!x);
      if (apptIds.length) {
        await em
          .getRepository(Appointment)
          .update(
            { id: In(apptIds), organizationId: org.organizationId, status: Not(In([AppointmentStatus.CANCELADO, AppointmentStatus.FALTOU])) },
            { status: AppointmentStatus.CONCLUIDO },
          );
      }
      Object.assign(o, { status: OrderStatus.FECHADA, closedAt: new Date() });
      await em.getRepository(Order).save(o);
    });
    return this.get(org, id);
  }

  /**
   * Cancela (aberta) ou estorna (paga). O estorno devolve os pagamentos — por isso o caixa em que
   * entraram precisa estar aberto — e apaga as comissões, desde que ainda não tenham sido pagas.
   */
  async cancel(org: OrgContext, id: string): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.find(em, org, id);
      if (o.status === OrderStatus.CANCELADA) throw new BadRequestException('A comanda já está cancelada');
      const payments = await em.getRepository(OrderPayment).find({ where: { orderId: o.id, organizationId: org.organizationId } });
      await this.assertSessionOpen(em, org, payments.map((p) => p.cashSessionId));
      const wasClosed = o.status === OrderStatus.FECHADA;
      const items = await em.getRepository(OrderItem).find({ where: { orderId: o.id, organizationId: org.organizationId } });
      await this.extras.onReverse(em, org, o, items, payments.filter((p) => p.method === PaymentMethod.VALE_PRESENTE), wasClosed);
      const paidOut = await em.getRepository(CommissionEntry).count({ where: { orderId: o.id, organizationId: org.organizationId, payoutId: Not(IsNull()) } });
      if (paidOut) throw new BadRequestException('A comissão desta comanda já foi paga. Ajuste no próximo fechamento.');
      await em.getRepository(CommissionEntry).delete({ orderId: o.id, organizationId: org.organizationId });
      await em.getRepository(OrderPayment).delete({ orderId: o.id, organizationId: org.organizationId });
      const paidCents = payments.reduce((t, p) => t + p.amountCents, 0);
      Object.assign(o, { status: OrderStatus.CANCELADA, cancelledAt: new Date(), pointsRedeemed: 0, pointsDiscountCents: 0 });
      await em.getRepository(Order).save(o);
      await this.audit.log(em, org, { action: 'ORDER_CANCELLED', entity: 'order', entityId: o.id, summary: wasClosed ? `Comanda #${o.number} estornada (fechada, ${formatBRL(paidCents)} devolvidos)` : paidCents ? `Comanda #${o.number} cancelada (${formatBRL(paidCents)} já recebidos devolvidos)` : `Comanda #${o.number} cancelada (sem pagamento)`, meta: { paidCents, wasClosed } });
    });
    return this.get(org, id);
  }

  /** Gasta pontos de fidelidade nesta comanda (0 desfaz o resgate). */
  async redeem(org: OrgContext, id: string, points: number): Promise<OrderDto> {
    await this.tenant.transaction(async (em) => {
      const o = await this.findOpen(em, org, id);
      await this.extras.redeem(em, org, o, points);
      await this.assertNotOverpaid(em, org, o);
    });
    return this.get(org, id);
  }

  // ---------------------------------------------------------------- utilitários

  private async find(em: EntityManager, org: OrgContext, id: string): Promise<Order> {
    const o = await em.getRepository(Order).findOne({ where: { id, organizationId: org.organizationId }, relations: { client: true } });
    if (!o) throw new NotFoundException('Comanda não encontrada');
    return o;
  }

  private async findOpen(em: EntityManager, org: OrgContext, id: string): Promise<Order> {
    const o = await this.find(em, org, id);
    if (o.status !== OrderStatus.ABERTA) throw new BadRequestException('A comanda não está aberta');
    return o;
  }

  private async totals(em: EntityManager, org: OrgContext, o: Order) {
    const [items, payments] = await Promise.all([
      em.getRepository(OrderItem).find({ where: { orderId: o.id, organizationId: org.organizationId } }),
      em.getRepository(OrderPayment).find({ where: { orderId: o.id, organizationId: org.organizationId } }),
    ]);
    return orderTotals(items, o.totalDiscountCents, payments);
  }

  /** Mexer em itens/desconto não pode deixar a comanda com pagamento maior que o total. */
  private async assertNotOverpaid(em: EntityManager, org: OrgContext, o: Order) {
    const t = await this.totals(em, org, o);
    if (t.paidCents > t.totalCents) throw new BadRequestException('O total ficaria menor que o já pago. Remova um pagamento antes.');
  }

  private async assertSessionOpen(em: EntityManager, org: OrgContext, sessionIds: string[]) {
    if (!sessionIds.length) return;
    const closed = await em
      .getRepository(CashSession)
      .count({ where: { id: In([...new Set(sessionIds)]), organizationId: org.organizationId, closedAt: Not(IsNull()) } });
    if (closed) throw new BadRequestException('O pagamento entrou num caixa já fechado. Não dá para estornar por aqui.');
  }
}

