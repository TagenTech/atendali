import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { cashExpected, OrderStatus, type CashSessionDto } from '@skedulei/contracts';
import { Member } from '../organizations/entities/member.entity';
import { Unit } from '../organizations/entities/unit.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './dto/finance.dto';
import { CashMovement } from './entities/cash-movement.entity';
import { CashSession } from './entities/cash-session.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { Order } from './entities/order.entity';

/** Unidade principal do negócio (a primeira ativa) — o caixa é por unidade. */
export async function mainUnit(em: EntityManager, organizationId: string): Promise<Unit> {
  const unit = await em.getRepository(Unit).findOne({ where: { organizationId, active: true }, order: { createdAt: 'ASC' } });
  if (!unit) throw new BadRequestException('Cadastre uma unidade antes');
  return unit;
}

/** Caixa aberto da unidade (ou null). */
export function openSession(em: EntityManager, organizationId: string, unitId: string) {
  return em.getRepository(CashSession).findOne({ where: { organizationId, unitId, closedAt: IsNull() } });
}

@Injectable()
export class CashService {
  constructor(private readonly tenant: TenantDb) {}

  async current(org: OrgContext): Promise<CashSessionDto | null> {
    return this.tenant.transaction(async (em) => {
      const unit = await mainUnit(em, org.organizationId);
      const s = await openSession(em, org.organizationId, unit.id);
      return s ? this.toDto(em, s) : null;
    });
  }

  async history(org: OrgContext): Promise<CashSessionDto[]> {
    return this.tenant.transaction(async (em) => {
      const rows = await em.getRepository(CashSession).find({
        where: { organizationId: org.organizationId },
        order: { openedAt: 'DESC' },
        take: 30,
      });
      return Promise.all(rows.map((s) => this.toDto(em, s)));
    });
  }

  async open(org: OrgContext, dto: OpenCashDto): Promise<CashSessionDto> {
    return this.tenant.transaction(async (em) => {
      const unit = await mainUnit(em, org.organizationId);
      if (await openSession(em, org.organizationId, unit.id)) throw new ConflictException('O caixa já está aberto');
      const s = await em.getRepository(CashSession).save(
        em.getRepository(CashSession).create({
          organizationId: org.organizationId,
          unitId: unit.id,
          openedByMemberId: org.memberId,
          openingCents: dto.openingCents,
          closedAt: null,
          countedCents: null,
        }),
      );
      return this.toDto(em, s);
    });
  }

  async movement(org: OrgContext, dto: CashMovementDto): Promise<CashSessionDto> {
    return this.tenant.transaction(async (em) => {
      const s = await this.requireOpen(em, org);
      if (dto.kind === 'SANGRIA') {
        const { expected } = await this.toDto(em, s);
        if (dto.amountCents > expected.drawerCents) throw new BadRequestException('A sangria é maior que o dinheiro na gaveta');
      }
      await em.getRepository(CashMovement).save(
        em.getRepository(CashMovement).create({
          organizationId: org.organizationId,
          sessionId: s.id,
          kind: dto.kind,
          amountCents: dto.amountCents,
          note: dto.note ?? null,
          memberId: org.memberId,
        }),
      );
      return this.toDto(em, s);
    });
  }

  /** Fecha com a conferência do dinheiro. Comandas abertas com pagamento precisam ser fechadas antes. */
  async close(org: OrgContext, dto: CloseCashDto): Promise<CashSessionDto> {
    return this.tenant.transaction(async (em) => {
      const s = await this.requireOpen(em, org);
      const pending = await em
        .getRepository(OrderPayment)
        .createQueryBuilder('p')
        .innerJoin('p.order', 'o')
        .where('p.cashSessionId = :sid AND o.status = :open', { sid: s.id, open: OrderStatus.ABERTA })
        .getCount();
      if (pending) throw new BadRequestException('Há comandas abertas com pagamento neste caixa. Feche-as antes.');
      Object.assign(s, { closedAt: new Date(), closedByMemberId: org.memberId, countedCents: dto.countedCents, notes: dto.notes ?? null });
      await em.getRepository(CashSession).save(s);
      return this.toDto(em, s);
    });
  }

  async requireOpen(em: EntityManager, org: OrgContext): Promise<CashSession> {
    const unit = await mainUnit(em, org.organizationId);
    const s = await openSession(em, org.organizationId, unit.id);
    if (!s) throw new BadRequestException('Abra o caixa antes de receber');
    return s;
  }

  async toDto(em: EntityManager, s: CashSession): Promise<CashSessionDto> {
    const [payments, movements, openOrders, people] = await Promise.all([
      em.getRepository(OrderPayment).find({ where: { cashSessionId: s.id, organizationId: s.organizationId } }),
      em.getRepository(CashMovement).find({ where: { sessionId: s.id, organizationId: s.organizationId }, order: { createdAt: 'ASC' } }),
      em.getRepository(Order).count({ where: { organizationId: s.organizationId, unitId: s.unitId, status: OrderStatus.ABERTA } }),
      em.getRepository(Member).find({
        where: { id: In([s.openedByMemberId, s.closedByMemberId].filter((x): x is string => !!x)), organizationId: s.organizationId },
        select: { id: true, name: true },
      }),
    ]);
    const name = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? '') : null);
    const expected = cashExpected({ openingCents: s.openingCents, payments, movements });
    return {
      id: s.id,
      status: s.closedAt ? 'FECHADO' : 'ABERTO',
      openedAt: s.openedAt.toISOString(),
      openedByName: name(s.openedByMemberId)!,
      openingCents: s.openingCents,
      closedAt: s.closedAt?.toISOString() ?? null,
      closedByName: name(s.closedByMemberId),
      countedCents: s.countedCents,
      movements: movements.map((m) => ({ id: m.id, kind: m.kind, amountCents: m.amountCents, note: m.note, createdAt: m.createdAt.toISOString() })),
      expected,
      differenceCents: s.countedCents === null ? null : s.countedCents - expected.drawerCents,
      openOrders,
    };
  }
}
