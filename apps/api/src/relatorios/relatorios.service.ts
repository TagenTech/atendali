import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, In, IsNull, LessThan, Not } from 'typeorm';
import {
  addDays,
  AppointmentStatus,
  buildOverview,
  daysBetween,
  effectiveHours,
  MemberStatus,
  todayIn,
  upcomingBirthdays,
  workingMinutes,
  zonedToUtc,
  type Birthday,
  type InactiveClient,
  type ReportOverview,
  type ReportRow,
} from '@skedulei/contracts';
import { Appointment } from '../agenda/entities/appointment.entity';
import { Client } from '../agenda/entities/client.entity';
import { Member } from '../organizations/entities/member.entity';
import { Unit } from '../organizations/entities/unit.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';

const MAX_DAYS = 366;

/** Relatórios de gestão. Tudo filtrado pelo negócio (e pelo RLS da transação); só leitura. */
@Injectable()
export class RelatoriosService {
  constructor(private readonly tenant: TenantDb) {}

  async overview(org: OrgContext, from: string, to: string): Promise<ReportOverview> {
    if (from > to) throw new BadRequestException('A data inicial vem antes da final');
    if (daysBetween(from, to) > MAX_DAYS) throw new BadRequestException(`Escolha no máximo ${MAX_DAYS} dias`);
    return this.tenant.transaction(async (em) => {
      const unit = await em.getRepository(Unit).findOneOrFail({ where: { organizationId: org.organizationId, active: true }, order: { createdAt: 'ASC' } });
      const tz = unit.timezone;
      const start = zonedToUtc(from, '00:00', tz);
      const end = zonedToUtc(addDays(to, 1), '00:00', tz);
      const rows = await em.getRepository(Appointment).find({
        where: { organizationId: org.organizationId, startsAt: Between(start, new Date(end.getTime() - 1)) },
        relations: { service: true, member: true },
        select: {
          id: true, status: true, startsAt: true, endsAt: true, serviceId: true, memberId: true, clientId: true, priceCents: true, source: true,
          service: { id: true, name: true },
          member: { id: true, name: true },
        },
      });
      const people = await em.getRepository(Member).find({ where: { organizationId: org.organizationId, bookable: true, archivedAt: IsNull(), status: In([MemberStatus.ATIVO, MemberStatus.SEM_ACESSO, MemberStatus.CONVIDADO]) } });
      const availableByMember = Object.fromEntries(people.map((m) => [m.id, workingMinutes(effectiveHours(unit.businessHours, m.workingHours), from, to)]));

      // Quem já tinha atendimento concluído antes do período = cliente que voltou.
      const clientIds = [...new Set(rows.filter((r) => r.status === AppointmentStatus.CONCLUIDO).map((r) => r.clientId))];
      const before = clientIds.length
        ? await em.getRepository(Appointment).find({ where: { organizationId: org.organizationId, clientId: In(clientIds), status: AppointmentStatus.CONCLUIDO, startsAt: LessThan(start) }, select: { id: true, clientId: true } })
        : [];
      const reportRows: ReportRow[] = rows.map((r) => ({
        status: r.status,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        serviceId: r.serviceId,
        serviceName: r.service.name,
        memberId: r.memberId,
        memberName: r.member.name,
        clientId: r.clientId,
        priceCents: r.priceCents,
        source: r.source,
      }));
      return buildOverview({ from, to, rows: reportRows, availableByMember, seenBefore: new Set(before.map((b) => b.clientId)) });
    });
  }

  /** Clientes cujo último atendimento concluído foi há `days` dias ou mais (os mais recentes primeiro). */
  async inactive(org: OrgContext, days: number): Promise<InactiveClient[]> {
    return this.tenant.transaction(async (em) => {
      const unit = await em.getRepository(Unit).findOneOrFail({ where: { organizationId: org.organizationId, active: true }, order: { createdAt: 'ASC' } });
      const today = todayIn(unit.timezone);
      const rows = (await em
        .getRepository(Appointment)
        .createQueryBuilder('a')
        .innerJoin('a.client', 'c')
        .select('a.clientId', 'clientId')
        .addSelect('MAX(a.startsAt)', 'last')
        .addSelect('COUNT(*)', 'visits')
        .where('a.organizationId = :org AND a.status = :done AND c.anonymizedAt IS NULL', { org: org.organizationId, done: AppointmentStatus.CONCLUIDO })
        .groupBy('a.clientId')
        .getRawMany<{ clientId: string; last: Date; visits: string }>());
      const cutoff = addDays(today, -days);
      const stale = rows
        .map((r) => ({ clientId: r.clientId, lastVisit: todayIn(unit.timezone, new Date(r.last)), visits: Number(r.visits) }))
        .filter((r) => r.lastVisit <= cutoff);
      if (!stale.length) return [];
      const clients = await em.getRepository(Client).find({ where: { id: In(stale.map((s) => s.clientId)), organizationId: org.organizationId, anonymizedAt: IsNull() }, select: { id: true, name: true, phone: true } });
      const byId = new Map(clients.map((c) => [c.id, c]));
      // Quem já marcou um horário futuro não está "sem voltar".
      const future = await em.getRepository(Appointment).find({
        where: { organizationId: org.organizationId, clientId: In(stale.map((s) => s.clientId)), status: In([AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]), startsAt: Not(LessThan(new Date())) },
        select: { id: true, clientId: true },
      });
      const booked = new Set(future.map((f) => f.clientId));
      return stale
        .filter((s) => byId.has(s.clientId) && !booked.has(s.clientId))
        .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
        .slice(0, 200)
        .map((s) => ({ clientId: s.clientId, name: byId.get(s.clientId)!.name, phone: byId.get(s.clientId)!.phone, lastVisit: s.lastVisit, daysAway: daysBetween(s.lastVisit, today), visits: s.visits }));
    });
  }

  async birthdays(org: OrgContext, days: number): Promise<Birthday[]> {
    return this.tenant.transaction(async (em) => {
      const unit = await em.getRepository(Unit).findOneOrFail({ where: { organizationId: org.organizationId, active: true }, order: { createdAt: 'ASC' } });
      const clients = await em.getRepository(Client).find({ where: { organizationId: org.organizationId, anonymizedAt: IsNull(), birthDate: Not(IsNull()) }, select: { id: true, name: true, phone: true, birthDate: true } });
      return upcomingBirthdays(clients, todayIn(unit.timezone), days).slice(0, 200);
    });
  }
}
