import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, In, IsNull, MoreThan, Not } from 'typeorm';
import {
  addDays,
  AppointmentSource,
  AppointmentStatus,
  canClientCancel,
  normalizePhone,
  publicName,
  ratingSummary,
  ONLINE_BOOKING,
  todayIn,
  vocabularyFor,
  zonedParts,
  type PublicBookingDto as PublicBookingResponse,
  type PublicOrgDto,
  type SlotsDto,
} from '@skedulei/contracts';
import { Review } from '../fidelizacao/entities/review.entity';
import { MailService } from '../mail/mail.service';
import { Organization } from '../organizations/entities/organization.entity';
import { brandingOf } from '../organizations/mappers';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { Unit } from '../organizations/entities/unit.entity';
import { PublicBookingDto, PublicSlotsQueryDto } from './dto/agenda.dto';
import { Appointment } from './entities/appointment.entity';
import { Client } from './entities/client.entity';
import { SchedulingService } from './scheduling.service';
import { WaitlistService } from './waitlist.service';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function formatAddress(u: Pick<Unit, 'street' | 'number' | 'district' | 'city' | 'state'>): string | null {
  const line = [u.street && `${u.street}${u.number ? `, ${u.number}` : ''}`, u.district, u.city && `${u.city}${u.state ? `/${u.state}` : ''}`]
    .filter(Boolean)
    .join(' · ');
  return line || null;
}

/**
 * Agendamento online, sem login: o cliente escolhe serviço, profissional e horário pela página
 * pública do negócio. Sem contexto de negócio (sem RLS): toda consulta filtra pelo negócio do slug.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly db: DataSource,
    private readonly scheduling: SchedulingService,
    private readonly waitlist: WaitlistService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async page(slug: string): Promise<PublicOrgDto> {
    const org = await this.org(slug);
    const em = this.db.manager;
    const unit = await this.scheduling.resolveUnit(em, org.id).catch(() => null);
    const services = await em.getRepository(ServiceItem).find({
      where: { organizationId: org.id, active: true, onlineBooking: true },
      order: { category: 'ASC', name: 'ASC' },
    });
    const pros = await this.scheduling.bookableMembers(em, org.id);
    const answered = await em.getRepository(Review).find({
      where: { organizationId: org.id, published: true, answeredAt: Not(IsNull()) },
      order: { answeredAt: 'DESC' },
      take: 300,
    });
    return {
      name: org.name,
      slug: org.slug,
      segment: org.segment,
      vocabulary: vocabularyFor(org.segment),
      phone: org.phone,
      branding: brandingOf(org),
      unit: unit
        ? { id: unit.id, name: unit.name, address: formatAddress(unit), timezone: unit.timezone, businessHours: unit.businessHours }
        : null,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      })),
      professionals: pros.map((m) => ({ id: m.id, name: m.name, color: m.color })),
      rating: ratingSummary(answered.map((r) => r.rating!)),
      reviews: answered
        .filter((r) => r.comment)
        .slice(0, 6)
        .map((r) => ({ rating: r.rating!, comment: r.comment, authorName: publicName(r.clientName ?? ''), createdAt: r.answeredAt!.toISOString() })),
    };
  }

  async slots(slug: string, q: PublicSlotsQueryDto): Promise<SlotsDto> {
    const org = await this.org(slug);
    const em = this.db.manager;
    const unit = await this.scheduling.resolveUnit(em, org.id);
    this.assertBookableDate(q.date, unit.timezone);
    const service = await this.onlineService(em, org.id, q.serviceId);
    const members = q.memberId ? [await this.scheduling.bookableMember(em, org.id, q.memberId)] : await this.scheduling.bookableMembers(em, org.id);
    return this.scheduling.slots(em, {
      organizationId: org.id,
      unit,
      date: q.date,
      durationMinutes: service.durationMinutes,
      members,
      notBefore: Date.now() + ONLINE_BOOKING.minLeadMinutes * 60_000,
      stepMinutes: ONLINE_BOOKING.stepMinutes,
    });
  }

  async book(slug: string, dto: PublicBookingDto): Promise<PublicBookingResponse> {
    const org = await this.org(slug);
    const token = randomBytes(24).toString('base64url');
    const id = await this.db.transaction(async (em) => {
      const phone = normalizePhone(dto.phone);
      // Sem login, quem quiser poderia ocupar a agenda toda: cada telefone mantém poucos horários futuros.
      const known = await em.getRepository(Client).findOne({ where: { organizationId: org.id, phone } });
      if (known) {
        const active = await em.getRepository(Appointment).count({
          where: { organizationId: org.id, clientId: known.id, source: AppointmentSource.ONLINE, status: In([AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]), startsAt: MoreThan(new Date()) },
        });
        if (active >= ONLINE_BOOKING.maxActivePerClient) {
          throw new ConflictException(`Você já tem ${active} horários marcados. Cancele um para marcar outro ou fale com a clínica.`);
        }
      }
      const unit = await this.scheduling.resolveUnit(em, org.id);
      const service = await this.onlineService(em, org.id, dto.serviceId);
      const date = zonedParts(new Date(dto.startsAt), unit.timezone).date;
      // O horário precisa estar entre os oferecidos (funcionamento, antecedência, passo de 15 min).
      const offered = await this.slots(slug, { date, serviceId: service.id, memberId: dto.memberId ?? undefined });
      const slot = offered.slots.find((s) => new Date(s.startsAt).getTime() === new Date(dto.startsAt).getTime());
      if (!slot) throw new ConflictException('Esse horário acabou de ser ocupado. Escolha outro, por favor.');
      const memberId = dto.memberId ?? slot.memberIds[0];
      const start = new Date(slot.startsAt);
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      await this.scheduling.assertFree(em, { organizationId: org.id, unitId: unit.id, memberId, start, end });

      const clients = em.getRepository(Client);
      let client = await clients.findOne({ where: { organizationId: org.id, phone }, order: { createdAt: 'ASC' } });
      if (!client) client = await clients.save(clients.create({ organizationId: org.id, name: dto.name, phone, email: dto.email ?? null }));
      else if (!client.email && dto.email) await clients.update(client.id, { email: dto.email });

      const saved = await em.getRepository(Appointment).save(
        em.getRepository(Appointment).create({
          organizationId: org.id,
          unitId: unit.id,
          clientId: client.id,
          memberId,
          serviceId: service.id,
          startsAt: start,
          endsAt: end,
          status: AppointmentStatus.AGENDADO,
          priceCents: service.priceCents,
          notes: null,
          source: AppointmentSource.ONLINE,
          manageTokenHash: hashToken(token),
        }),
      );
      return saved.id;
    });
    const booking = await this.toDto(id, token);
    if (dto.email) {
      const when = `${new Date(booking.startsAt).toLocaleDateString('pt-BR', { timeZone: booking.timezone, weekday: 'long', day: 'numeric', month: 'long' })} às ${zonedParts(new Date(booking.startsAt), booking.timezone).time}`;
      await this.mail.sendBookingConfirmation(dto.email, {
        clientName: dto.name,
        orgName: booking.organizationName,
        serviceName: booking.serviceName,
        professionalName: booking.professionalName,
        when,
        url: `${this.config.get<string>('publicWebUrl')}/reserva/${token}`,
      });
    }
    return booking;
  }

  async get(token: string): Promise<PublicBookingResponse> {
    return this.toDto(await this.idByToken(token), token);
  }

  async cancel(token: string): Promise<PublicBookingResponse> {
    const id = await this.idByToken(token);
    const repo = this.db.getRepository(Appointment);
    const a = await repo.findOneByOrFail({ id });
    if (!canClientCancel(a.status, a.startsAt.toISOString())) {
      throw new BadRequestException(`Pelo link só dá para cancelar até ${ONLINE_BOOKING.cancelUntilHours}h antes. Fale com o estabelecimento.`);
    }
    await this.db.transaction(async (em) => {
      await em.getRepository(Appointment).update(id, { status: AppointmentStatus.CANCELADO });
      const unit = await this.scheduling.resolveUnit(em, a.organizationId, a.unitId);
      await this.waitlist.onSlotFreed(em, a, unit.timezone);
    });
    return this.toDto(id, token);
  }

  // ---------------------------------------------------------------- utilitários

  private async org(slug: string): Promise<Organization> {
    const org = await this.db.getRepository(Organization).findOne({ where: { slug: String(slug).toLowerCase().slice(0, 48) } });
    if (!org) throw new NotFoundException('Página não encontrada');
    return org;
  }

  private async onlineService(em: EntityManager, organizationId: string, id: string): Promise<ServiceItem> {
    const s = await em.getRepository(ServiceItem).findOne({ where: { id, organizationId, active: true, onlineBooking: true } });
    if (!s) throw new NotFoundException('Serviço indisponível para agendamento online');
    return s;
  }

  private assertBookableDate(date: string, timezone: string) {
    const today = todayIn(timezone);
    if (date < today || date > addDays(today, ONLINE_BOOKING.maxDaysAhead)) {
      throw new BadRequestException(`Escolha uma data entre hoje e os próximos ${ONLINE_BOOKING.maxDaysAhead} dias`);
    }
  }

  private async idByToken(token: string): Promise<string> {
    const row = await this.db
      .getRepository(Appointment)
      .createQueryBuilder('a')
      .select('a.id', 'id')
      .where('a.manage_token_hash = :h', { h: hashToken(String(token).slice(0, 100)) })
      .getRawOne<{ id: string }>();
    if (!row) throw new NotFoundException('Agendamento não encontrado');
    return row.id;
  }

  private async toDto(id: string, token: string): Promise<PublicBookingResponse> {
    const a = await this.db.getRepository(Appointment).findOneOrFail({
      where: { id },
      relations: { client: true, member: true, service: true, unit: true, organization: true },
    });
    return {
      token,
      organizationName: a.organization.name,
      organizationSlug: a.organization.slug,
      organizationPhone: a.organization.phone,
      serviceName: a.service.name,
      professionalName: a.member.name,
      clientName: a.client.name,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      timezone: a.unit.timezone,
      status: a.status,
      address: formatAddress(a.unit),
      canCancel: canClientCancel(a.status, a.startsAt.toISOString()),
    };
  }
}
