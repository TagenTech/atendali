import { Injectable } from '@nestjs/common';
import { LessThan, MoreThan } from 'typeorm';
import { AppointmentStatus, CALL_HIGHLIGHT_SECONDS, publicName, type TvBoardDto, type TvEntryDto } from '@agendei/contracts';
import { Organization } from '../organizations/entities/organization.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { Appointment } from './entities/appointment.entity';
import { APPOINTMENT_RELATIONS } from './mappers';
import { dayRange, SchedulingService } from './scheduling.service';

/**
 * Painel de TV da recepção: só primeiro nome e inicial (a tela fica à vista de quem espera) e nada de dado de
 * saúde, valor ou telefone.
 */
@Injectable()
export class TvService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly scheduling: SchedulingService,
  ) {}

  async board(org: OrgContext): Promise<TvBoardDto> {
    return this.tenant.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.organizationId);
      const now = new Date();
      const { start, end } = dayRange(new Intl.DateTimeFormat('en-CA', { timeZone: unit.timezone }).format(now), unit.timezone);
      const rows = await em.getRepository(Appointment).find({
        where: { organizationId: org.organizationId, unitId: unit.id, startsAt: LessThan(end), endsAt: MoreThan(start) },
        relations: APPOINTMENT_RELATIONS,
        order: { startsAt: 'ASC' },
      });
      const entry = (a: Appointment): TvEntryDto => ({
        id: a.id,
        name: publicName(a.client.name),
        professionalName: a.member.name,
        startsAt: a.startsAt.toISOString(),
        calledAt: a.calledAt?.toISOString() ?? null,
      });
      const live = rows.filter((a) => a.status === AppointmentStatus.AGENDADO || a.status === AppointmentStatus.CONFIRMADO || a.status === AppointmentStatus.CHEGOU);
      const isCalling = (a: Appointment) => !!a.calledAt && now.getTime() - a.calledAt.getTime() <= CALL_HIGHLIGHT_SECONDS * 1000;
      const calling = live.filter(isCalling).sort((a, b) => b.calledAt!.getTime() - a.calledAt!.getTime());
      const callingIds = new Set(calling.map((a) => a.id));
      const org2 = await em.getRepository(Organization).findOneOrFail({ where: { id: org.organizationId }, select: { id: true, name: true } });
      return {
        organizationName: org2.name,
        timezone: unit.timezone,
        now: now.toISOString(),
        calling: calling.map(entry),
        waiting: live.filter((a) => a.status === AppointmentStatus.CHEGOU && !callingIds.has(a.id)).map(entry),
        inService: rows.filter((a) => a.status === AppointmentStatus.EM_ATENDIMENTO).map(entry),
        next: live
          .filter((a) => a.status !== AppointmentStatus.CHEGOU && !callingIds.has(a.id) && a.endsAt.getTime() >= now.getTime())
          .slice(0, 6)
          .map(entry),
      };
    });
  }
}
