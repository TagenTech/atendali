import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
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
  anyOverlap,
  planSequences,
  samePerson,
  normalizePersonName,
  todayIn,
  vocabularyFor,
  zonedParts,
  type PublicBookingDto as PublicBookingResponse,
  type PublicGroupBookingDto as PublicGroupBookingResponse,
  type PublicOrgDto,
  type SequenceSlotsDto,
  type SlotsDto,
} from '@skedulei/contracts';
import { Review } from '../fidelizacao/entities/review.entity';
import { MailService } from '../mail/mail.service';
import { Organization } from '../organizations/entities/organization.entity';
import { brandingOf } from '../organizations/mappers';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { Unit } from '../organizations/entities/unit.entity';
import { PublicBookingDto, PublicGroupBookingDto, PublicSlotsQueryDto, RescheduleDto } from './dto/agenda.dto';
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

  async slots(slug: string, q: PublicSlotsQueryDto, excludeAppointmentId?: string, stepMinutes: number = ONLINE_BOOKING.stepMinutes): Promise<SlotsDto> {
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
      stepMinutes,
      excludeAppointmentId,
    });
  }

  async book(slug: string, dto: PublicBookingDto): Promise<PublicBookingResponse> {
    const org = await this.org(slug);
    const token = randomBytes(24).toString('base64url');
    const id = await this.db.transaction(async (em) => {
      const phone = normalizePhone(dto.phone);
      const family = await this.assertFamilyCap(em, org.id, phone, 1);
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

      const client = await this.resolvePatient(em, org.id, phone, family, dto);

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
    await this.cancelById(id);
    return this.toDto(id, token);
  }

  /** Remarca pelo link da reserva (mesma regra de antecedência do cancelamento). */
  async reschedule(token: string, dto: RescheduleDto): Promise<PublicBookingResponse> {
    const id = await this.idByToken(token);
    await this.rescheduleById(id, dto);
    return this.toDto(id, token);
  }

  /** Cancela um agendamento já autorizado (pelo token da reserva ou pela área "Minhas reservas"). */
  async cancelById(id: string): Promise<void> {
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
  }

  /** Muda o horário (e, se pedido, o profissional) de um agendamento já autorizado. O horário precisa estar entre os oferecidos. */
  async rescheduleById(id: string, dto: RescheduleDto): Promise<void> {
    const a = await this.db.getRepository(Appointment).findOneOrFail({ where: { id }, relations: { organization: true } });
    if (!canClientCancel(a.status, a.startsAt.toISOString())) {
      throw new BadRequestException(`Só dá para remarcar até ${ONLINE_BOOKING.cancelUntilHours}h antes. Fale com o estabelecimento.`);
    }
    await this.db.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, a.organizationId, a.unitId);
      const service = await this.onlineService(em, a.organizationId, a.serviceId);
      const date = zonedParts(new Date(dto.startsAt), unit.timezone).date;
      this.assertBookableDate(date, unit.timezone);
      const offered = await this.slots(a.organization.slug, { date, serviceId: service.id, memberId: dto.memberId ?? undefined }, a.id);
      const slot = offered.slots.find((s) => new Date(s.startsAt).getTime() === new Date(dto.startsAt).getTime());
      if (!slot) throw new ConflictException('Esse horário acabou de ser ocupado. Escolha outro, por favor.');
      // Sem preferência: fica com quem já atendia, se estiver livre.
      const memberId = dto.memberId ?? (slot.memberIds.includes(a.memberId) ? a.memberId : slot.memberIds[0]);
      const start = new Date(slot.startsAt);
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      await this.scheduling.assertFree(em, { organizationId: a.organizationId, unitId: unit.id, memberId, start, end, excludeAppointmentId: a.id });
      await em.getRepository(Appointment).update(a.id, { startsAt: start, endsAt: end, memberId });
      // O horário antigo vagou: avisa a lista de espera.
      await this.waitlist.onSlotFreed(em, a, unit.timezone);
    });
  }

  // ---------------------------------------------------------------- vários procedimentos (carrinho)

  /** Teto de horários futuros por telefone (a família toda); `adding` = quantos esta reserva acrescenta. Devolve a família. */
  private async assertFamilyCap(em: EntityManager, organizationId: string, phone: string, adding: number): Promise<Client[]> {
    // Sem login, quem quiser poderia ocupar a agenda toda: cada telefone mantém poucos horários futuros.
    const family = await em.getRepository(Client).find({ where: { organizationId, phone } });
    if (family.length) {
      const active = await em.getRepository(Appointment).count({
        where: { organizationId, clientId: In(family.map((c) => c.id)), source: AppointmentSource.ONLINE, status: In([AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]), startsAt: MoreThan(new Date()) },
      });
      if (active + adding > ONLINE_BOOKING.maxActivePerPhone) {
        throw new ConflictException(
          active >= ONLINE_BOOKING.maxActivePerPhone
            ? `Você já tem ${active} horários marcados. Cancele um para marcar outro ou fale com a clínica.`
            : `Você já tem ${active} horários marcados e o limite é ${ONLINE_BOOKING.maxActivePerPhone}. Marque menos procedimentos agora ou cancele algum.`,
        );
      }
    }
    return family;
  }

  /** O telefone é de quem marca (responsável); o paciente pode ser outra pessoa (filho, mãe…). */
  private async resolvePatient(
    em: EntityManager,
    organizationId: string,
    phone: string,
    family: Client[],
    dto: { name: string; email?: string | null; patientName?: string | null; patientBirthDate?: string | null; relationship?: PublicBookingDto['relationship'] },
  ): Promise<Client> {
    const clients = em.getRepository(Client);
    const patientName = dto.patientName?.trim() || dto.name;
    const forOther = !samePerson(patientName, dto.name);
    let client = pickPatient(family, patientName, forOther);
    if (!client) {
      return clients.save(
        clients.create({
          organizationId,
          name: patientName,
          phone,
          email: dto.email ?? null,
          birthDate: dto.patientBirthDate ?? null,
          guardianName: forOther ? dto.name : null,
          guardianRelationship: forOther ? (dto.relationship ?? null) : null,
        }),
      );
    }
    const patch: Partial<Client> = {};
    if (!client.email && dto.email) patch.email = dto.email;
    if (!client.birthDate && dto.patientBirthDate) patch.birthDate = dto.patientBirthDate;
    if (forOther && !client.guardianName) Object.assign(patch, { guardianName: dto.name, guardianRelationship: dto.relationship ?? null });
    if (Object.keys(patch).length) {
      await clients.update(client.id, patch);
      client = { ...client, ...patch } as Client;
    }
    return client;
  }

  /** Todos os procedimentos um logo após o outro: os inícios possíveis do primeiro e quem atende cada um. */
  async sequenceSlots(slug: string, date: string, serviceIds: string[]): Promise<SequenceSlotsDto> {
    const org = await this.org(slug);
    const em = this.db.manager;
    const unit = await this.scheduling.resolveUnit(em, org.id);
    this.assertBookableDate(date, unit.timezone);
    const ids = [...new Set(serviceIds)];
    if (ids.length < 2 || ids.length > ONLINE_BOOKING.maxItemsPerBooking) {
      throw new BadRequestException(`Escolha de 2 a ${ONLINE_BOOKING.maxItemsPerBooking} procedimentos`);
    }
    const services = [];
    for (const id of ids) services.push(await this.onlineService(em, org.id, id));
    const members = await this.scheduling.bookableMembers(em, org.id);
    const common = { organizationId: org.id, unit, date, members, notBefore: Date.now() + ONLINE_BOOKING.minLeadMinutes * 60_000 };
    // Grade fina (5 min) para os seguintes encaixarem logo ao fim do anterior; o primeiro só em horários "redondos".
    const offered: Record<string, string[]>[] = [];
    for (const s of services) {
      const r = await this.scheduling.slots(em, { ...common, durationMinutes: s.durationMinutes, stepMinutes: 5 });
      offered.push(Object.fromEntries(r.slots.map((x) => [x.startsAt, x.memberIds])));
    }
    const first = await this.scheduling.slots(em, { ...common, durationMinutes: services[0].durationMinutes, stepMinutes: ONLINE_BOOKING.stepMinutes });
    return {
      date,
      options: planSequences({
        services: services.map((s) => ({ serviceId: s.id, durationMinutes: s.durationMinutes })),
        offered,
        firstStarts: first.slots.map((x) => x.startsAt),
      }),
    };
  }

  /** Reserva de 1 a 5 procedimentos, tudo ou nada, com um link só. */
  async bookGroup(slug: string, dto: PublicGroupBookingDto): Promise<PublicGroupBookingResponse> {
    const org = await this.org(slug);
    const token = randomBytes(24).toString('base64url');
    const groupId = randomUUID();
    const single = dto.items.length === 1;
    await this.db.transaction(async (em) => {
      const unit = await this.scheduling.resolveUnit(em, org.id);
      const phone = normalizePhone(dto.phone);
      const family = await this.assertFamilyCap(em, org.id, phone, dto.items.length);

      // Resolve cada item (procedimento, horário oferecido, profissional) antes de gravar qualquer um.
      const planned: { service: ServiceItem; memberId: string; start: Date; end: Date }[] = [];
      for (const item of dto.items) {
        const service = await this.onlineService(em, org.id, item.serviceId);
        const date = zonedParts(new Date(item.startsAt), unit.timezone).date;
        this.assertBookableDate(date, unit.timezone);
        // Grade de 5 min: o procedimento seguinte de uma sequência começa quando o anterior termina (ex.: 10:40).
        const offered = await this.slots(slug, { date, serviceId: service.id, memberId: item.memberId ?? undefined }, undefined, 5);
        const slot = offered.slots.find((s) => new Date(s.startsAt).getTime() === new Date(item.startsAt).getTime());
        if (!slot) throw new ConflictException(`O horário de ${service.name} acabou de ser ocupado. Escolha outro, por favor.`);
        const start = new Date(slot.startsAt);
        planned.push({ service, memberId: item.memberId ?? slot.memberIds[0], start, end: new Date(start.getTime() + service.durationMinutes * 60_000) });
      }
      // A mesma pessoa não pode estar em dois procedimentos ao mesmo tempo.
      if (anyOverlap(planned.map((p) => ({ startsAt: p.start.toISOString(), endsAt: p.end.toISOString() })))) {
        throw new BadRequestException('Dois procedimentos ficaram no mesmo horário. Escolha horários diferentes.');
      }
      const client = await this.resolvePatient(em, org.id, phone, family, dto);
      const repo = em.getRepository(Appointment);
      for (const p of planned) {
        await this.scheduling.assertFree(em, { organizationId: org.id, unitId: unit.id, memberId: p.memberId, start: p.start, end: p.end });
        await repo.save(
          repo.create({
            organizationId: org.id,
            unitId: unit.id,
            clientId: client.id,
            memberId: p.memberId,
            serviceId: p.service.id,
            startsAt: p.start,
            endsAt: p.end,
            status: AppointmentStatus.AGENDADO,
            priceCents: p.service.priceCents,
            notes: null,
            source: AppointmentSource.ONLINE,
            bookingGroupId: groupId,
            // Um procedimento só segue o fluxo antigo (um link por agendamento); vários dividem o link do grupo.
            manageTokenHash: single ? hashToken(token) : null,
            groupTokenHash: single ? null : hashToken(token),
          }),
        );
      }
    });
    const group = await this.getGroup(token);
    if (dto.email) {
      const lines = group.items.map((i) => `${i.serviceName} com ${i.professionalName}, ${this.whenText(i.startsAt, group.timezone)}`);
      await this.mail.sendBookingConfirmation(dto.email, {
        clientName: dto.name,
        orgName: group.organizationName,
        serviceName: group.items.map((i) => i.serviceName).join(' + '),
        professionalName: [...new Set(group.items.map((i) => i.professionalName))].join(' e '),
        when: single ? this.whenText(group.items[0].startsAt, group.timezone) : lines.join('; '),
        url: `${this.config.get<string>('publicWebUrl')}/reserva/${token}`,
      }).catch(() => undefined);
    }
    return group;
  }

  /** A reserva do link: um ou vários procedimentos. */
  async getGroup(token: string): Promise<PublicGroupBookingResponse> {
    const ids = await this.idsByToken(token);
    const rows = await this.db.getRepository(Appointment).find({
      where: { id: In(ids) },
      relations: { client: true, member: true, service: true, unit: true, organization: true },
      order: { startsAt: 'ASC' },
    });
    const first = rows[0];
    return {
      token,
      organizationName: first.organization.name,
      organizationSlug: first.organization.slug,
      organizationPhone: first.organization.phone,
      timezone: first.unit.timezone,
      address: formatAddress(first.unit),
      items: rows.map((a) => ({
        id: a.id,
        serviceId: a.serviceId,
        serviceName: a.service.name,
        professionalName: a.member.name,
        clientName: a.client.name,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        canCancel: canClientCancel(a.status, a.startsAt.toISOString()),
      })),
    };
  }

  /** Cancela um procedimento (`itemId`) ou, sem `itemId`, todos os que ainda podem ser cancelados. */
  async cancelGroup(token: string, itemId?: string | null): Promise<PublicGroupBookingResponse> {
    const ids = await this.idsByToken(token);
    if (itemId && !ids.includes(itemId)) throw new NotFoundException('Procedimento não encontrado nesta reserva');
    const targets = itemId ? [itemId] : ids;
    const rows = await this.db.getRepository(Appointment).find({ where: { id: In(targets) } });
    const open = rows.filter((a) => canClientCancel(a.status, a.startsAt.toISOString()));
    if (!open.length) {
      throw new BadRequestException(`Pelo link só dá para cancelar até ${ONLINE_BOOKING.cancelUntilHours}h antes. Fale com o estabelecimento.`);
    }
    for (const a of open) await this.cancelById(a.id);
    return this.getGroup(token);
  }

  /** Remarca um procedimento da reserva (`itemId` é obrigatório quando há mais de um). */
  async rescheduleGroup(token: string, dto: RescheduleDto): Promise<PublicGroupBookingResponse> {
    const ids = await this.idsByToken(token);
    const id = dto.itemId ?? (ids.length === 1 ? ids[0] : null);
    if (!id) throw new BadRequestException('Escolha qual procedimento remarcar');
    if (!ids.includes(id)) throw new NotFoundException('Procedimento não encontrado nesta reserva');
    await this.rescheduleById(id, dto);
    return this.getGroup(token);
  }

  private whenText(startsAt: string, timezone: string) {
    return `${new Date(startsAt).toLocaleDateString('pt-BR', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' })} às ${zonedParts(new Date(startsAt), timezone).time}`;
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

  /** Agendamentos do link: o próprio (reserva de um procedimento) ou todos do grupo, em ordem de horário. */
  private async idsByToken(token: string): Promise<string[]> {
    const h = hashToken(String(token).slice(0, 100));
    const rows = await this.db
      .getRepository(Appointment)
      .createQueryBuilder('a')
      .select('a.id', 'id')
      .where('a.manage_token_hash = :h OR a.group_token_hash = :h', { h })
      .orderBy('a.starts_at', 'ASC')
      .getRawMany<{ id: string }>();
    if (!rows.length) throw new NotFoundException('Agendamento não encontrado');
    return rows.map((r) => r.id);
  }

  private async idByToken(token: string): Promise<string> {
    return (await this.idsByToken(token))[0];
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
      serviceId: a.serviceId,
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

/** Quem já existe com este telefone: nome igual; para quem marca para si mesmo, vale também o primeiro nome (se só houver um). */
function pickPatient(family: Client[], patientName: string, forOther: boolean): Client | null {
  const exact = family.find((c) => samePerson(c.name, patientName));
  if (exact || forOther) return exact ?? null;
  const first = normalizePersonName(patientName).split(' ')[0];
  const sameFirst = family.filter((c) => !c.guardianName && normalizePersonName(c.name).split(' ')[0] === first);
  return sameFirst.length === 1 ? sameFirst[0] : null;
}
