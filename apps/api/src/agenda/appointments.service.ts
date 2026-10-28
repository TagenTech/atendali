import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, LessThan, MoreThan } from 'typeorm';
import {
  addDays,
  AppointmentSource,
  AppointmentStatus,
  can,
  canMoveTo,
  Permission,
  effectiveHours,
  withinBusinessHours,
  type AgendaDayDto,
  type AppointmentDto,
  type BlockDto,
  type SlotsDto,
} from '@agendei/contracts';
import type { OrgContext } from '../organizations/org-context';
import { OrderItem } from '../financeiro/entities/order-item.entity';
import { Member } from '../organizations/entities/member.entity';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import { TenantDb } from '../tenancy/tenant-db';
import { CreateAppointmentDto, CreateBlockDto, DayQueryDto, SlotsQueryDto, UpdateAppointmentDto } from './dto/agenda.dto';
import { Appointment } from './entities/appointment.entity';
import { ScheduleBlock } from './entities/block.entity';
import { Client } from './entities/client.entity';
import { APPOINTMENT_RELATIONS, toAppointmentDto, toBlockDto } from './mappers';
import { dayRange, SchedulingService } from './scheduling.service';
import { WaitlistService } from './waitlist.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly scheduling: SchedulingService,
    private readonly waitlist: WaitlistService,
  ) {}

  /** Profissional sem "ver todos" só enxerga a própria coluna. */
  private onlyMine(org: OrgContext): string | null {
    return can(org.role, Permission.AGENDA_VIEW_ALL) ? null : org.memberId;
  }

  private assertCanWrite(org: OrgContext, memberId: string) {
    if (can(org.role, Permission.AGENDA_MANAGE_ALL)) return;
    if (can(org.role, Permission.AGENDA_OWN) && memberId === org.memberId) return;
    throw new ForbiddenException('Seu perfil só mexe na própria agenda');
  }

  async day(org: OrgContext, q: DayQueryDto): Promise<AgendaDayDto> {
    return this.tenant.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.organizationId, q.unitId);
      const days = q.days ?? 1;
      const { start } = dayRange(q.date, unit.timezone);
      const { end } = dayRange(addDays(q.date, days - 1), unit.timezone);
      const mine = this.onlyMine(org);
      const appts = await em.getRepository(Appointment).find({
        where: {
          organizationId: org.organizationId,
          unitId: unit.id,
          startsAt: LessThan(end),
          endsAt: MoreThan(start),
          ...(mine ? { memberId: mine } : {}),
        },
        relations: APPOINTMENT_RELATIONS,
        order: { startsAt: 'ASC' },
      });
      const blocks = await em
        .getRepository(ScheduleBlock)
        .createQueryBuilder('b')
        .where('b.organizationId = :org AND b.unitId = :unit', { org: org.organizationId, unit: unit.id })
        .andWhere('b.startsAt < :end AND b.endsAt > :start', { start, end })
        .andWhere(mine ? '(b.memberId IS NULL OR b.memberId = :mine)' : '1=1', { mine })
        .orderBy('b.startsAt', 'ASC')
        .getMany();
      const pros = (await this.scheduling.bookableMembers(em, org.organizationId)).filter((m) => !mine || m.id === mine);
      return {
        date: q.date,
        days,
        timezone: unit.timezone,
        unitId: unit.id,
        hours: unit.businessHours,
        professionals: pros.map((m) => ({ id: m.id, name: m.name, color: m.color, hours: effectiveHours(unit.businessHours, m.workingHours) })),
        appointments: await this.withOrders(em, appts),
        blocks: blocks.map(toBlockDto),
      };
    });
  }

  /** Sugestão de horários para a recepção (sem antecedência mínima, só não deixa marcar no passado). */
  async slots(org: OrgContext, q: SlotsQueryDto): Promise<SlotsDto> {
    return this.tenant.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.organizationId, q.unitId);
      const service = await this.service(em, org.organizationId, q.serviceId);
      const mine = this.onlyMine(org);
      if (mine && q.memberId && q.memberId !== mine) throw new ForbiddenException('Seu perfil só vê a própria agenda');
      const wanted = q.memberId ?? mine;
      const members = wanted
        ? [await this.scheduling.bookableMember(em, org.organizationId, wanted)]
        : await this.scheduling.bookableMembers(em, org.organizationId);
      return this.scheduling.slots(em, {
        organizationId: org.organizationId,
        unit,
        date: q.date,
        durationMinutes: service.durationMinutes,
        members,
        notBefore: Date.now(),
      });
    });
  }

  async create(org: OrgContext, dto: CreateAppointmentDto): Promise<AppointmentDto> {
    this.assertCanWrite(org, dto.memberId);
    if (!dto.clientId && !dto.newClient) throw new BadRequestException('Escolha o cliente');
    const id = await this.tenant.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.organizationId, dto.unitId);
      const service = await this.service(em, org.organizationId, dto.serviceId, true);
      const member = await this.scheduling.bookableMember(em, org.organizationId, dto.memberId);
      const start = new Date(dto.startsAt);
      const end = new Date(start.getTime() + (dto.durationMinutes ?? service.durationMinutes) * 60_000);
      if (!dto.allowOutsideHours && !withinBusinessHours(start, end, effectiveHours(unit.businessHours, member.workingHours), unit.timezone)) {
        throw new BadRequestException('Fora do horário de funcionamento. Marque "encaixe" para agendar assim mesmo.');
      }
      await this.scheduling.assertFree(em, { organizationId: org.organizationId, unitId: unit.id, memberId: dto.memberId, start, end });

      let clientId = dto.clientId;
      if (clientId) {
        const exists = await em.getRepository(Client).exists({ where: { id: clientId, organizationId: org.organizationId } });
        if (!exists) throw new NotFoundException('Cliente não encontrado');
      } else {
        const c = await em
          .getRepository(Client)
          .save(em.getRepository(Client).create({ organizationId: org.organizationId, name: dto.newClient!.name, phone: dto.newClient!.phone ?? null }));
        clientId = c.id;
      }
      const saved = await em.getRepository(Appointment).save(
        em.getRepository(Appointment).create({
          organizationId: org.organizationId,
          unitId: unit.id,
          clientId,
          memberId: dto.memberId,
          serviceId: service.id,
          startsAt: start,
          endsAt: end,
          status: AppointmentStatus.AGENDADO,
          priceCents: dto.priceCents ?? service.priceCents,
          notes: dto.notes ?? null,
          source: AppointmentSource.RECEPCAO,
          createdByMemberId: org.memberId,
        }),
      );
      return saved.id;
    });
    return this.get(org, id);
  }

  async update(org: OrgContext, id: string, dto: UpdateAppointmentDto): Promise<AppointmentDto> {
    await this.tenant.transaction(async (em) => {
      const a = await em.getRepository(Appointment).findOne({ where: { id, organizationId: org.organizationId } });
      if (!a) throw new NotFoundException('Agendamento não encontrado');
      this.assertCanWrite(org, a.memberId);
      if (dto.memberId) this.assertCanWrite(org, dto.memberId);

      if (dto.status && !canMoveTo(a.status, dto.status)) {
        throw new BadRequestException('Essa mudança de status não é permitida');
      }
      const moving = dto.memberId !== undefined || dto.startsAt !== undefined || dto.durationMinutes !== undefined;
      const original = { organizationId: a.organizationId, serviceId: a.serviceId, memberId: a.memberId, startsAt: a.startsAt };
      const reopening = a.status === AppointmentStatus.CANCELADO && dto.status && dto.status !== AppointmentStatus.CANCELADO;
      if (moving || reopening) {
        const memberId = dto.memberId ?? a.memberId;
        const start = dto.startsAt ? new Date(dto.startsAt) : a.startsAt;
        const minutes = dto.durationMinutes ?? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
        const end = new Date(start.getTime() + minutes * 60_000);
        const member = dto.memberId
          ? await this.scheduling.bookableMember(em, org.organizationId, memberId)
          : await em.getRepository(Member).findOneByOrFail({ id: memberId, organizationId: org.organizationId });
        const unit = await this.scheduling.resolveUnit(em, org.organizationId, a.unitId);
        const hours = effectiveHours(unit.businessHours, member.workingHours);
        if (moving && !dto.allowOutsideHours && !withinBusinessHours(start, end, hours, unit.timezone)) {
          throw new BadRequestException('Fora do horário de funcionamento. Marque "encaixe" para agendar assim mesmo.');
        }
        await this.scheduling.assertFree(em, { organizationId: org.organizationId, unitId: a.unitId, memberId, start, end, excludeAppointmentId: a.id });
        Object.assign(a, { memberId, startsAt: start, endsAt: end });
      }
      // Horário que vagou (cancelado ou remarcado para outro lugar) → avisa a lista de espera.
      const relocated = a.startsAt.getTime() !== original.startsAt.getTime() || a.memberId !== original.memberId;
      const cancelling = dto.status === AppointmentStatus.CANCELADO && a.status !== AppointmentStatus.CANCELADO;
      const freed = (cancelling || relocated) && a.status !== AppointmentStatus.CANCELADO ? original : null;
      if (dto.status) a.status = dto.status;
      if (dto.priceCents !== undefined) a.priceCents = dto.priceCents;
      if (dto.notes !== undefined) a.notes = dto.notes;
      await em.getRepository(Appointment).save(a);
      if (freed) {
        const unit = await this.scheduling.resolveUnit(em, org.organizationId, a.unitId);
        await this.waitlist.onSlotFreed(em, freed, unit.timezone);
      }
    });
    return this.get(org, id);
  }

  /** Chama o cliente no painel de TV da recepção. */
  async call(org: OrgContext, id: string): Promise<AppointmentDto> {
    const a = await this.tenant.repo(Appointment).findOne({ where: { id, organizationId: org.organizationId } });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    this.assertCanWrite(org, a.memberId);
    if (a.status !== AppointmentStatus.AGENDADO && a.status !== AppointmentStatus.CONFIRMADO && a.status !== AppointmentStatus.CHEGOU) {
      throw new BadRequestException('Só dá para chamar quem ainda não foi atendido');
    }
    await this.tenant.repo(Appointment).update({ id, organizationId: org.organizationId }, { calledAt: new Date() });
    return this.get(org, id);
  }

  async get(org: OrgContext, id: string): Promise<AppointmentDto> {
    const a = await this.tenant.repo(Appointment).findOne({ where: { id, organizationId: org.organizationId }, relations: APPOINTMENT_RELATIONS });
    const mine = this.onlyMine(org);
    if (!a || (mine && a.memberId !== mine)) throw new NotFoundException('Agendamento não encontrado');
    return (await this.withOrders(this.tenant.repo(Appointment).manager, [a]))[0];
  }

  // ---------------------------------------------------------------- bloqueios

  async createBlock(org: OrgContext, dto: CreateBlockDto): Promise<BlockDto> {
    if (dto.memberId) this.assertCanWrite(org, dto.memberId);
    else if (!can(org.role, Permission.AGENDA_MANAGE_ALL)) throw new ForbiddenException('Seu perfil não bloqueia a unidade inteira');
    const start = new Date(dto.startsAt);
    const end = new Date(dto.endsAt);
    if (end <= start) throw new BadRequestException('O fim precisa ser depois do início');
    return this.tenant.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.organizationId);
      if (dto.memberId) await this.scheduling.bookableMember(em, org.organizationId, dto.memberId);
      const b = await em.getRepository(ScheduleBlock).save(
        em.getRepository(ScheduleBlock).create({
          organizationId: org.organizationId,
          unitId: unit.id,
          memberId: dto.memberId ?? null,
          startsAt: start,
          endsAt: end,
          reason: dto.reason ?? null,
        }),
      );
      return toBlockDto(b);
    });
  }

  async removeBlock(org: OrgContext, id: string): Promise<void> {
    const repo = this.tenant.repo(ScheduleBlock);
    const b = await repo.findOne({ where: { id, organizationId: org.organizationId } });
    if (!b) throw new NotFoundException('Bloqueio não encontrado');
    if (b.memberId) this.assertCanWrite(org, b.memberId);
    else if (!can(org.role, Permission.AGENDA_MANAGE_ALL)) throw new ForbiddenException('Seu perfil não mexe em bloqueios da unidade');
    await repo.delete({ id, organizationId: org.organizationId });
  }

  /** Liga cada agendamento à comanda dele (aberta ou paga), para a agenda mostrar "Abrir"/"Ver comanda". */
  private async withOrders(em: EntityManager, appts: Appointment[]): Promise<AppointmentDto[]> {
    const ids = appts.map((a) => a.id);
    const rows = ids.length
      ? await em
          .getRepository(OrderItem)
          .createQueryBuilder('i')
          .innerJoin('i.order', 'o')
          .select(['i.appointmentId AS "appointmentId"', 'o.id AS "orderId"'])
          .where('i.appointmentId IN (:...ids)', { ids })
          .andWhere("o.status <> 'CANCELADA'")
          .getRawMany<{ appointmentId: string; orderId: string }>()
      : [];
    const byAppt = new Map(rows.map((r) => [r.appointmentId, r.orderId]));
    return appts.map((a) => toAppointmentDto(a, byAppt.get(a.id) ?? null));
  }

  private async service(em: EntityManager, organizationId: string, id: string, mustBeActive = false): Promise<ServiceItem> {
    const s = await em.getRepository(ServiceItem).findOne({ where: { id, organizationId } });
    if (!s) throw new NotFoundException('Serviço não encontrado');
    if (mustBeActive && !s.active) throw new BadRequestException('Esse serviço está desativado');
    return s;
  }
}
