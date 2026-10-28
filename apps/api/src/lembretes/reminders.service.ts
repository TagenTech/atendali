import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Between, DataSource, In, IsNull, Not } from 'typeorm';
import { AppointmentStatus, dueReminder, formatDateLong, Role, zonedParts, type ReminderKind } from '@skedulei/contracts';
import { Appointment } from '../agenda/entities/appointment.entity';
import { formatAddress } from '../agenda/booking.service';
import { signReminderLink } from '../agenda/reminder-link';
import { Events, type BookingChangedEvent } from '../common/events';
import { MailService } from '../mail/mail.service';
import { Member } from '../organizations/entities/member.entity';

const RELATIONS = { client: true, member: true, service: true, unit: true, organization: true } as const;

export interface ReminderRunResult {
  checked: number;
  sent: { H24: number; H2: number };
}

/**
 * Lembretes por e-mail (24 h e 2 h antes) e avisos à equipe. O job roda a cada 5 minutos (`@Cron`, quando
 * `SCHEDULER_ENABLED` não é `false`) ou chamado de fora em `POST /v1/internal/jobs/reminders` (pg_cron).
 * É um job de sistema (todos os negócios): não passa pelo RLS — cada consulta já nasce filtrada por negócio ligado.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Lembretes');

  constructor(
    private readonly db: DataSource,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/5 * * * *')
  async tick() {
    if (process.env.SCHEDULER_ENABLED === 'false') return;
    await this.run().catch((err) => this.logger.error(`Falha no job de lembretes: ${(err as Error).message}`));
  }

  async run(now = Date.now()): Promise<ReminderRunResult> {
    const repo = this.db.getRepository(Appointment);
    const rows = await repo.find({
      where: {
        status: In([AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]),
        startsAt: Between(new Date(now), new Date(now + 25 * 3_600_000)),
        organization: { remindersEnabled: true },
        client: { email: Not(IsNull()), anonymizedAt: IsNull() },
      },
      relations: RELATIONS,
      order: { startsAt: 'ASC' },
      take: 500,
    });
    const result: ReminderRunResult = { checked: rows.length, sent: { H24: 0, H2: 0 } };
    for (const a of rows) {
      const kind = dueReminder(
        { startsAt: a.startsAt.toISOString(), createdAt: a.createdAt.toISOString(), status: a.status, reminded24At: a.reminded24At?.toISOString() ?? null, reminded2At: a.reminded2At?.toISOString() ?? null },
        now,
      );
      if (!kind) continue;
      // "Reserva" a vez antes de mandar: dois servidores rodando juntos não mandam duas vezes.
      const column = kind === 'H24' ? 'reminded24At' : 'reminded2At';
      const claimed = await repo.update({ id: a.id, [column]: IsNull() }, { [column]: new Date(now) });
      if (!claimed.affected) continue;
      try {
        await this.send(a, kind);
        result.sent[kind]++;
      } catch (err) {
        this.logger.error(`Lembrete ${kind} do agendamento ${a.id}: ${(err as Error).message}`);
      }
    }
    return result;
  }

  private async send(a: Appointment, kind: ReminderKind) {
    const tz = a.unit.timezone;
    const p = zonedParts(a.startsAt, tz);
    const secret = this.config.getOrThrow<string>('jwt.secret');
    const token = signReminderLink(secret, a.id, a.startsAt.getTime() + 24 * 3_600_000);
    await this.mail.sendReminder(a.client.email!, {
      patientName: a.client.name,
      orgName: a.organization.name,
      serviceName: a.service.name,
      professionalName: a.member.name,
      when: `${formatDateLong(p.date, false)} às ${p.time}`,
      address: formatAddress(a.unit),
      kind,
      url: `${this.config.get<string>('publicWebUrl')}/reserva/${token}`,
    });
  }

  // ---------------------------------------------------------------- avisos à equipe

  @OnEvent(Events.BOOKING_CREATED, { async: true })
  onCreated(e: BookingChangedEvent) {
    return this.notifyStaff('created', e);
  }
  @OnEvent(Events.BOOKING_CANCELLED, { async: true })
  onCancelled(e: BookingChangedEvent) {
    return this.notifyStaff('cancelled', e);
  }
  @OnEvent(Events.BOOKING_RESCHEDULED, { async: true })
  onRescheduled(e: BookingChangedEvent) {
    return this.notifyStaff('rescheduled', e);
  }

  /** Um e-mail por profissional afetado (quem tem e-mail); sem e-mail, vai para o(s) dono(s). Nunca derruba a reserva. */
  private async notifyStaff(what: 'created' | 'cancelled' | 'rescheduled', e: BookingChangedEvent) {
    try {
      const rows = await this.db.getRepository(Appointment).find({ where: { id: In(e.appointmentIds) }, relations: RELATIONS, order: { startsAt: 'ASC' } });
      const byMember = new Map<string, Appointment[]>();
      for (const a of rows) byMember.set(a.memberId, [...(byMember.get(a.memberId) ?? []), a]);
      for (const items of byMember.values()) {
        const first = items[0];
        const to = new Set<string>();
        if (first.member.email) to.add(first.member.email);
        else {
          const owners = await this.db.getRepository(Member).find({ where: { organizationId: first.organizationId, role: Role.DONO }, select: { id: true, email: true } });
          owners.forEach((o) => o.email && to.add(o.email));
        }
        const lines = items.map((a) => {
          const p = zonedParts(a.startsAt, a.unit.timezone);
          return `${a.client.name} — ${a.service.name} com ${a.member.name}, ${formatDateLong(p.date, false)} às ${p.time}`;
        });
        for (const address of to) await this.mail.sendStaffBookingNotice(address, { what, orgName: first.organization.name, lines });
      }
    } catch (err) {
      this.logger.error(`Aviso à equipe falhou: ${(err as Error).message}`);
    }
  }
}
