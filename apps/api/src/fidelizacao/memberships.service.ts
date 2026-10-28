import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  currentCycle,
  Feature,
  membershipCanUse,
  membershipState,
  type ClientMembershipDto,
  type IsoDate,
  type MembershipPlanDto as MembershipPlanResponse,
} from '@agendei/contracts';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { assertFeature } from '../tenancy/feature-gate';
import { orgToday } from '../tenancy/org-today';
import { TenantDb } from '../tenancy/tenant-db';
import { MembershipPlanDto, UpdateMembershipPlanDto } from './dto/retention.dto';
import { ClientMembership, MembershipPlan, MembershipUse } from './entities/membership.entity';

/** Sessões usadas por assinatura no ciclo atual. */
export async function usedInCycle(em: EntityManager, organizationId: string, m: ClientMembership, today: IsoDate): Promise<number> {
  if (!m.anchor) return 0;
  const c = currentCycle(m.anchor, today);
  const row = await em
    .getRepository(MembershipUse)
    .createQueryBuilder('u')
    .select('COALESCE(SUM(u.quantity), 0)', 'n')
    .where('u.organizationId = :organizationId AND u.membershipId = :id', { organizationId, id: m.id })
    .andWhere('u.usedDate BETWEEN :s AND :e', { s: c.start, e: c.end })
    .getRawOne<{ n: string }>();
  return Number(row?.n ?? 0);
}

export function toMembershipDto(m: ClientMembership, today: IsoDate, used: number): ClientMembershipDto {
  const state = membershipState(m, today);
  const cycle = m.anchor ? currentCycle(m.anchor, today) : null;
  return {
    id: m.id,
    clientId: m.clientId,
    clientName: m.client?.name ?? '',
    planId: m.planId,
    planName: m.planName,
    priceCents: m.priceCents,
    serviceId: m.serviceId,
    serviceName: m.service?.name ?? null,
    sessionsPerMonth: m.sessionsPerMonth,
    status: m.status,
    state,
    paidThrough: m.paidThrough,
    cycle: cycle ? { start: cycle.start, end: cycle.end } : null,
    sessionsUsedInCycle: used,
    canUse: membershipCanUse(state, m.sessionsPerMonth, used),
  };
}

@Injectable()
export class MembershipsService {
  constructor(private readonly tenant: TenantDb) {}

  private gate(em: EntityManager, org: OrgContext) {
    return assertFeature(em, org.organizationId, Feature.ASSINATURAS);
  }

  async plans(org: OrgContext): Promise<MembershipPlanResponse[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const rows = await em.getRepository(MembershipPlan).find({ where: { organizationId: org.organizationId }, relations: { service: true }, order: { active: 'DESC', name: 'ASC' } });
      return rows.map(this.planDto);
    });
  }

  async createPlan(org: OrgContext, dto: MembershipPlanDto): Promise<MembershipPlanResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      let service: ServiceItem | null = null;
      if (dto.serviceId) {
        service = await em.getRepository(ServiceItem).findOne({ where: { id: dto.serviceId, organizationId: org.organizationId } });
        if (!service) throw new NotFoundException('Serviço não encontrado');
      }
      const row = await em.getRepository(MembershipPlan).save(
        em.getRepository(MembershipPlan).create({
          organizationId: org.organizationId,
          name: dto.name,
          priceCents: dto.priceCents,
          serviceId: service?.id ?? null,
          sessionsPerMonth: dto.sessionsPerMonth ?? null,
          active: true,
        }),
      );
      return this.planDto({ ...row, service } as MembershipPlan);
    });
  }

  async updatePlan(org: OrgContext, id: string, dto: UpdateMembershipPlanDto): Promise<MembershipPlanResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const p = await em.getRepository(MembershipPlan).findOne({ where: { id, organizationId: org.organizationId }, relations: { service: true } });
      if (!p) throw new NotFoundException('Plano não encontrado');
      Object.assign(p, {
        name: dto.name ?? p.name,
        priceCents: dto.priceCents ?? p.priceCents,
        sessionsPerMonth: dto.sessionsPerMonth !== undefined ? dto.sessionsPerMonth : p.sessionsPerMonth,
        active: dto.active ?? p.active,
      });
      return this.planDto(await em.getRepository(MembershipPlan).save(p));
    });
  }

  async list(org: OrgContext, clientId?: string): Promise<ClientMembershipDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const today = await orgToday(em, org.organizationId);
      const rows = await em.getRepository(ClientMembership).find({
        where: { organizationId: org.organizationId, ...(clientId ? { clientId } : {}) },
        relations: { client: true, service: true },
        order: { createdAt: 'DESC' },
        take: 200,
      });
      return Promise.all(rows.map(async (m) => toMembershipDto(m, today, await usedInCycle(em, org.organizationId, m, today))));
    });
  }

  /** Pausar, reativar ou cancelar. Cancelada não volta (cria-se outra pela comanda). */
  async setStatus(org: OrgContext, id: string, status: 'ATIVA' | 'PAUSADA' | 'CANCELADA'): Promise<ClientMembershipDto> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const m = await em.getRepository(ClientMembership).findOne({ where: { id, organizationId: org.organizationId }, relations: { client: true, service: true } });
      if (!m) throw new NotFoundException('Assinatura não encontrada');
      if (m.status === 'CANCELADA') throw new BadRequestException('Assinatura cancelada não volta. Venda uma nova pela comanda.');
      m.status = status;
      await em.getRepository(ClientMembership).save(m);
      const today = await orgToday(em, org.organizationId);
      return toMembershipDto(m, today, await usedInCycle(em, org.organizationId, m, today));
    });
  }

  private planDto = (p: MembershipPlan): MembershipPlanResponse => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    serviceId: p.serviceId,
    serviceName: p.service?.name ?? null,
    sessionsPerMonth: p.sessionsPerMonth,
    active: p.active,
  });
}

