import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, EntityManager, In, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import {
  addDays,
  AppointmentStatus,
  availableSlots,
  effectiveHours,
  MemberStatus,
  zonedToUtc,
  type Interval,
  type IsoDate,
  type SlotsDto,
} from '@skedulei/contracts';
import { Member } from '../organizations/entities/member.entity';
import { Unit } from '../organizations/entities/unit.entity';
import { Appointment } from './entities/appointment.entity';
import { ScheduleBlock } from './entities/block.entity';

/** Começo e fim (UTC) de um dia no fuso da unidade. */
export function dayRange(date: IsoDate, timezone: string) {
  return { start: zonedToUtc(date, '00:00', timezone), end: zonedToUtc(addDays(date, 1), '00:00', timezone) };
}

/**
 * Regras de horário compartilhadas pela agenda interna e pelo agendamento online:
 * unidade do negócio, quem atende, o que está ocupado e os horários livres.
 * Sempre recebe o `EntityManager` da transação (a do negócio, com RLS, ou a da página pública).
 */
@Injectable()
export class SchedulingService {
  /** A unidade pedida, ou a primeira ativa do negócio. */
  async resolveUnit(em: EntityManager, organizationId: string, unitId?: string): Promise<Unit> {
    const unit = await em.getRepository(Unit).findOne({
      where: unitId ? { id: unitId, organizationId } : { organizationId, active: true },
      order: { createdAt: 'ASC' },
    });
    if (!unit) throw new NotFoundException('Unidade não encontrada');
    return unit;
  }

  /** Pessoas que atendem (têm coluna na agenda). */
  bookableMembers(em: EntityManager, organizationId: string): Promise<Member[]> {
    return em.getRepository(Member).find({
      where: { organizationId, bookable: true, archivedAt: IsNull(), status: In([MemberStatus.ATIVO, MemberStatus.SEM_ACESSO, MemberStatus.CONVIDADO]) },
      order: { name: 'ASC' },
    });
  }

  async bookableMember(em: EntityManager, organizationId: string, memberId: string): Promise<Member> {
    const m = await em.getRepository(Member).findOne({ where: { id: memberId, organizationId } });
    if (!m) throw new NotFoundException('Profissional não encontrado');
    if (!m.bookable) throw new BadRequestException(`${m.name} não atende clientes na agenda`);
    return m;
  }

  /** Ocupado por profissional entre `from` e `to`: agendamentos que ocupam a agenda + bloqueios (dele ou da unidade). */
  async busy(
    em: EntityManager,
    organizationId: string,
    unitId: string,
    memberIds: string[],
    from: Date,
    to: Date,
    excludeAppointmentId?: string,
  ): Promise<Map<string, Interval[]>> {
    const out = new Map<string, Interval[]>(memberIds.map((id) => [id, []]));
    if (!memberIds.length) return out;
    const appts = await em.getRepository(Appointment).find({
      where: {
        organizationId,
        memberId: In(memberIds),
        status: Not(AppointmentStatus.CANCELADO),
        startsAt: LessThan(to),
        endsAt: MoreThan(from),
        ...(excludeAppointmentId ? { id: Not(excludeAppointmentId) } : {}),
      },
      select: { id: true, memberId: true, startsAt: true, endsAt: true },
    });
    for (const a of appts) out.get(a.memberId)!.push({ start: a.startsAt.getTime(), end: a.endsAt.getTime() });

    const blocks = await em
      .getRepository(ScheduleBlock)
      .createQueryBuilder('b')
      .where('b.organizationId = :organizationId AND b.unitId = :unitId', { organizationId, unitId })
      .andWhere('b.startsAt < :to AND b.endsAt > :from', { from, to })
      .andWhere(new Brackets((w) => w.where('b.memberId IS NULL').orWhere('b.memberId IN (:...memberIds)', { memberIds })))
      .getMany();
    for (const b of blocks) {
      const iv = { start: b.startsAt.getTime(), end: b.endsAt.getTime() };
      for (const id of b.memberId ? [b.memberId] : memberIds) out.get(id)?.push(iv);
    }
    return out;
  }

  /**
   * Garante que o profissional está livre no intervalo. Trava a linha dele até o fim da transação:
   * duas recepções marcando o mesmo horário ao mesmo tempo — a segunda vê a primeira e recebe 409.
   */
  async assertFree(
    em: EntityManager,
    p: { organizationId: string; unitId: string; memberId: string; start: Date; end: Date; excludeAppointmentId?: string },
  ) {
    await em.getRepository(Member).createQueryBuilder('m').setLock('pessimistic_write').where('m.id = :id', { id: p.memberId }).getOne();
    const busy = await this.busy(em, p.organizationId, p.unitId, [p.memberId], p.start, p.end, p.excludeAppointmentId);
    const iv = { start: p.start.getTime(), end: p.end.getTime() };
    if (busy.get(p.memberId)!.some((b) => b.start < iv.end && iv.start < b.end)) {
      throw new ConflictException('Esse horário já está ocupado para esse profissional');
    }
  }

  /** Horários livres do dia para cada profissional pedido. */
  async slots(
    em: EntityManager,
    p: {
      organizationId: string;
      unit: Unit;
      date: IsoDate;
      durationMinutes: number;
      members: Pick<Member, 'id' | 'workingHours'>[];
      notBefore?: number;
      stepMinutes?: number;
      /** Remarcação: o próprio agendamento não pode bloquear o novo horário. */
      excludeAppointmentId?: string;
    },
  ): Promise<SlotsDto> {
    const { start, end } = dayRange(p.date, p.unit.timezone);
    const busy = await this.busy(em, p.organizationId, p.unit.id, p.members.map((m) => m.id), start, end, p.excludeAppointmentId);
    const byStart = new Map<string, string[]>();
    for (const { id: memberId, workingHours } of p.members) {
      for (const s of availableSlots({
        date: p.date,
        timezone: p.unit.timezone,
        hours: effectiveHours(p.unit.businessHours, workingHours),
        durationMinutes: p.durationMinutes,
        busy: busy.get(memberId) ?? [],
        notBefore: p.notBefore,
        stepMinutes: p.stepMinutes,
      })) {
        byStart.set(s, [...(byStart.get(s) ?? []), memberId]);
      }
    }
    return {
      date: p.date,
      slots: [...byStart.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([startsAt, memberIds]) => ({ startsAt, memberIds })),
    };
  }
}
