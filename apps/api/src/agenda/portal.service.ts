import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import {
  AppointmentStatus,
  canClientCancel,
  normalizePhone,
  ONLINE_BOOKING,
  type PortalBookingDto,
  type PortalSessionDto,
} from '@skedulei/contracts';
import { MailService } from '../mail/mail.service';
import { Organization } from '../organizations/entities/organization.entity';
import { BookingService, formatAddress } from './booking.service';
import { RescheduleDto } from './dto/agenda.dto';
import { Appointment } from './entities/appointment.entity';
import { Client } from './entities/client.entity';
import { PortalCode } from './entities/portal-code.entity';

const UNAUTHORIZED = 'Código inválido ou expirado. Peça um novo.';

/**
 * "Minhas reservas": a pessoa informa o telefone, recebe um código no e-mail cadastrado nesse telefone e,
 * com ele, vê/cancela/remarca as reservas de todos os pacientes daquele telefone naquele negócio.
 * Sem e-mail cadastrado não há como provar a posse do telefone — a resposta é sempre a mesma (não revela cadastros).
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly booking: BookingService,
  ) {}

  async requestCode(slug: string, phoneRaw: string): Promise<{ sent: true }> {
    const org = await this.org(slug);
    const phone = normalizePhone(phoneRaw);
    const codes = this.db.getRepository(PortalCode);
    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await codes.count({ where: { organizationId: org.id, phone, createdAt: MoreThan(hourAgo) } });
    // Passou do limite por hora: não manda mais (evita encher a caixa de entrada de alguém), sem avisar o motivo.
    if (recent >= ONLINE_BOOKING.codeMaxPerHour) return { sent: true };

    const family = await this.db.getRepository(Client).find({ where: { organizationId: org.id, phone, anonymizedAt: IsNull() } });
    const emails = [...new Set(family.map((c) => c.email?.toLowerCase()).filter((e): e is string => !!e))].slice(0, 3);
    if (!emails.length) return { sent: true };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await codes.save(
      codes.create({
        organizationId: org.id,
        phone,
        codeHash: this.hash(org.id, phone, code),
        expiresAt: new Date(Date.now() + ONLINE_BOOKING.codeTtlMinutes * 60_000),
      }),
    );
    // Sem esperar o envio: a resposta demora o mesmo com ou sem cadastro.
    for (const to of emails) void this.mail.sendPortalCode(to, { orgName: org.name, code, ttlMinutes: ONLINE_BOOKING.codeTtlMinutes }).catch(() => undefined);
    return { sent: true };
  }

  async verify(slug: string, phoneRaw: string, code: string): Promise<PortalSessionDto> {
    const org = await this.org(slug);
    const phone = normalizePhone(phoneRaw);
    const codes = this.db.getRepository(PortalCode);
    const row = await codes.findOne({ where: { organizationId: org.id, phone, usedAt: IsNull(), expiresAt: MoreThan(new Date()) }, order: { createdAt: 'DESC' } });
    if (!row || row.attempts >= ONLINE_BOOKING.codeMaxAttempts) throw new UnauthorizedException(UNAUTHORIZED);
    const expected = Buffer.from(row.codeHash, 'hex');
    const given = Buffer.from(this.hash(org.id, phone, code), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      await codes.increment({ id: row.id }, 'attempts', 1);
      throw new UnauthorizedException(UNAUTHORIZED);
    }
    await codes.update(row.id, { usedAt: new Date() });
    const expiresIn = ONLINE_BOOKING.portalSessionMinutes * 60;
    return { token: this.sign({ o: org.id, p: phone, exp: Math.floor(Date.now() / 1000) + expiresIn }), expiresIn };
  }

  async list(slug: string, token: string | undefined): Promise<PortalBookingDto[]> {
    const { org, phone } = await this.session(slug, token);
    const ids = await this.familyIds(org.id, phone);
    if (!ids.length) return [];
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.db.getRepository(Appointment).find({
      where: { organizationId: org.id, clientId: In(ids), startsAt: MoreThan(since) },
      relations: { client: true, member: true, service: true, unit: true },
      order: { startsAt: 'ASC' },
      take: 60,
    });
    return rows
      .filter((a) => a.status !== AppointmentStatus.CANCELADO)
      .map((a) => ({
        id: a.id,
        patientName: a.client.name,
        serviceId: a.serviceId,
        serviceName: a.service.name,
        memberId: a.memberId,
        professionalName: a.member.name,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        timezone: a.unit.timezone,
        status: a.status,
        address: formatAddress(a.unit),
        canChange: canClientCancel(a.status, a.startsAt.toISOString()),
      }));
  }

  async cancel(slug: string, token: string | undefined, id: string): Promise<void> {
    const { org, phone } = await this.session(slug, token);
    await this.own(org.id, phone, id);
    await this.booking.cancelById(id);
  }

  async reschedule(slug: string, token: string | undefined, id: string, dto: RescheduleDto): Promise<void> {
    const { org, phone } = await this.session(slug, token);
    await this.own(org.id, phone, id);
    await this.booking.rescheduleById(id, dto);
  }

  // ---------------------------------------------------------------- utilitários

  private async org(slug: string): Promise<Organization> {
    const org = await this.db.getRepository(Organization).findOne({ where: { slug: String(slug).toLowerCase().slice(0, 48) } });
    if (!org) throw new NotFoundException('Página não encontrada');
    return org;
  }

  private async familyIds(organizationId: string, phone: string): Promise<string[]> {
    const rows = await this.db.getRepository(Client).find({ where: { organizationId, phone, anonymizedAt: IsNull() }, select: { id: true } });
    return rows.map((c) => c.id);
  }

  /** O agendamento é do negócio da sessão e de um paciente do telefone da sessão. */
  private async own(organizationId: string, phone: string, id: string) {
    const ids = await this.familyIds(organizationId, phone);
    const a = ids.length ? await this.db.getRepository(Appointment).findOne({ where: { id, organizationId, clientId: In(ids) }, select: { id: true } }) : null;
    if (!a) throw new NotFoundException('Reserva não encontrada');
  }

  private async session(slug: string, token: string | undefined) {
    const org = await this.org(slug);
    const claims = this.read(token);
    if (!claims || claims.o !== org.id) throw new UnauthorizedException('Sessão expirada. Peça um novo código.');
    return { org, phone: claims.p };
  }

  private secret() {
    return this.config.getOrThrow<string>('jwt.secret');
  }

  private hash(orgId: string, phone: string, code: string) {
    return createHmac('sha256', this.secret()).update(`portal-code:${orgId}:${phone}:${code}`).digest('hex');
  }

  private sign(claims: { o: string; p: string; exp: number }): string {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const mac = createHmac('sha256', this.secret()).update(`portal:${body}`).digest('base64url');
    return `${body}.${mac}`;
  }

  private read(token: string | undefined): { o: string; p: string; exp: number } | null {
    if (!token || token.length > 600) return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', this.secret()).update(`portal:${body}`).digest('base64url');
    if (expected.length !== mac.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
    try {
      const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as { o: string; p: string; exp: number };
      return typeof c.exp === 'number' && c.exp > Date.now() / 1000 && typeof c.o === 'string' && typeof c.p === 'string' ? c : null;
    } catch {
      return null;
    }
  }
}

export const bearer = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined);
