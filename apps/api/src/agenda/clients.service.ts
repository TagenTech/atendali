import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import {
  AppointmentStatus,
  normalizePhone,
  previewClientImport,
  type ClientDetailDto,
  type ClientDto as ClientResponse,
  type ClientImportPreview,
  type ClientImportReport,
} from '@skedulei/contracts';
import { AuditService } from '../auditoria/audit.service';
import { encryptField } from '../common/crypto/field-crypto';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { ClientDto, UpdateClientDto } from './dto/agenda.dto';
import { Appointment } from './entities/appointment.entity';
import { Review } from '../fidelizacao/entities/review.entity';
import { Client } from './entities/client.entity';
import { APPOINTMENT_RELATIONS, toAppointmentDto, toClientDto } from './mappers';

const cleanTags = (tags?: string[]) => (tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))] : undefined);

@Injectable()
export class ClientsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  private get repo() {
    return this.tenant.repo(Client);
  }

  /** Busca por nome, telefone ou e-mail (até 50; sem busca, os mais recentes). */
  async list(org: OrgContext, q?: string): Promise<ClientResponse[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.organizationId = :org AND c.anonymizedAt IS NULL', { org: org.organizationId })
      .take(50);
    const term = q?.trim();
    if (term) {
      const digits = term.replace(/\D/g, '');
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.name ILIKE :like', { like: `%${term}%` })
            .orWhere('c.guardianName ILIKE :like', { like: `%${term}%` })
            .orWhere('c.email ILIKE :like', { like: `%${term}%` });
          if (digits.length >= 3) w.orWhere('c.phone LIKE :digits', { digits: `%${digits}%` });
        }),
      );
      qb.orderBy('c.name', 'ASC');
    } else {
      qb.orderBy('c.createdAt', 'DESC');
    }
    return (await qb.getMany()).map(toClientDto);
  }

  async get(org: OrgContext, id: string): Promise<ClientDetailDto> {
    const c = await this.find(org, id);
    const appts = await this.tenant.repo(Appointment).find({
      where: { organizationId: org.organizationId, clientId: id },
      relations: APPOINTMENT_RELATIONS,
      order: { startsAt: 'DESC' },
      take: 100,
    });
    const now = Date.now();
    const done = appts.filter((a) => a.status === AppointmentStatus.CONCLUIDO);
    const past = appts.filter((a) => a.startsAt.getTime() <= now && a.status !== AppointmentStatus.CANCELADO);
    // Irmãos, pais e filhos dividem o telefone: a ficha mostra os outros pacientes do mesmo número.
    const relatives = c.phone
      ? await this.repo
          .createQueryBuilder('r')
          .where('r.organizationId = :org AND r.phone = :phone AND r.id != :id AND r.anonymizedAt IS NULL', { org: org.organizationId, phone: c.phone, id: c.id })
          .orderBy('r.name', 'ASC')
          .take(20)
          .getMany()
      : [];
    return {
      ...toClientDto(c),
      relatives: relatives.map((r) => ({ id: r.id, name: r.name, birthDate: r.birthDate })),
      appointments: appts.map((a) => toAppointmentDto(a)),
      stats: {
        total: appts.filter((a) => a.status !== AppointmentStatus.CANCELADO).length,
        done: done.length,
        noShows: appts.filter((a) => a.status === AppointmentStatus.FALTOU).length,
        spentCents: done.reduce((s, a) => s + a.priceCents, 0),
        lastVisit: past[0]?.startsAt.toISOString() ?? null,
      },
    };
  }

  async create(org: OrgContext, dto: ClientDto): Promise<ClientResponse> {
    const row = this.repo.create({
      organizationId: org.organizationId,
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      birthDate: dto.birthDate ?? null,
      guardianName: dto.guardianName ?? null,
      guardianRelationship: dto.guardianName ? (dto.guardianRelationship ?? null) : null,
      notesEncrypted: dto.notes ? encryptField(dto.notes) : null,
      tags: cleanTags(dto.tags) ?? [],
    });
    return toClientDto(await this.repo.save(row));
  }

  async update(org: OrgContext, id: string, dto: UpdateClientDto): Promise<ClientResponse> {
    const c = await this.find(org, id);
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.phone !== undefined) c.phone = dto.phone;
    if (dto.email !== undefined) c.email = dto.email;
    if (dto.birthDate !== undefined) c.birthDate = dto.birthDate;
    if (dto.guardianName !== undefined) c.guardianName = dto.guardianName;
    if (dto.guardianRelationship !== undefined) c.guardianRelationship = dto.guardianRelationship;
    if (!c.guardianName) c.guardianRelationship = null;
    if (dto.notes !== undefined) c.notesEncrypted = dto.notes ? encryptField(dto.notes) : null;
    if (dto.tags !== undefined) c.tags = cleanTags(dto.tags)!;
    return toClientDto(await this.repo.save(c));
  }

  /** Celulares e e-mails já cadastrados no negócio (para ignorar quem já existe). */
  private async existingKeys(org: OrgContext) {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select(['c.phone', 'c.email', 'c.name'])
      .where('c.organizationId = :org AND c.anonymizedAt IS NULL', { org: org.organizationId })
      .getMany();
    return {
      people: rows.filter((r) => !!r.phone).map((r) => ({ phone: r.phone!, name: r.name })),
      emails: rows.map((r) => r.email?.toLowerCase()).filter((x): x is string => !!x),
    };
  }

  /** Pré-visualização da importação por CSV: valida linha a linha, sem gravar nada. */
  async importPreview(org: OrgContext, csv: string): Promise<ClientImportPreview> {
    return previewClientImport(csv, await this.existingKeys(org));
  }

  /** Importa as linhas válidas (revalida no servidor) e devolve o relatório de importados e ignorados. */
  async importRun(org: OrgContext, csv: string): Promise<ClientImportReport> {
    return this.tenant.transaction(async (em) => {
      // Duas importações juntas no mesmo negócio não duplicam: a segunda espera a primeira.
      await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`client-import:${org.organizationId}`]);
      const preview = previewClientImport(csv, await this.existingKeys(org));
      if (preview.fatal) throw new BadRequestException(preview.fatal);
      const ok = preview.rows.filter((r) => r.status === 'OK' && r.data);
      const repo = em.getRepository(Client);
      for (let i = 0; i < ok.length; i += 200) {
        await repo.insert(
          ok.slice(i, i + 200).map(({ data: d }) => ({
            organizationId: org.organizationId,
            name: d!.name,
            phone: d!.phone,
            email: d!.email,
            birthDate: d!.birthDate,
            notesEncrypted: d!.notes ? encryptField(d!.notes) : null,
            tags: d!.tags,
          })),
        );
      }
      return { imported: ok.length, duplicated: preview.counts.duplicated, errors: preview.counts.errors, rows: preview.rows.filter((r) => r.status !== 'OK') };
    });
  }

  /** Exclusão a pedido do titular (LGPD): apaga os dados pessoais, mantém os atendimentos sem identificação. */
  async anonymize(org: OrgContext, id: string): Promise<void> {
    const c = await this.find(org, id);
    await this.tenant.transaction(async (em) => {
      // Avaliações já feitas ficam, sem o nome.
      await em.getRepository(Review).update({ clientId: c.id, organizationId: org.organizationId }, { clientName: null, clientId: null });
      await em.getRepository(Client).update(
        { id: c.id, organizationId: org.organizationId },
        { name: 'Cliente removido', phone: null, email: null, birthDate: null, guardianName: null, guardianRelationship: null, notesEncrypted: null, tags: [], anonymizedAt: new Date() },
      );
      // O registro não leva o nome: senão a exclusão a pedido do titular não apagaria nada de verdade.
      await this.audit.log(em, org, { action: 'CLIENT_ANONYMIZED', entity: 'client', entityId: c.id, summary: 'Cliente excluído a pedido (dados pessoais apagados; o histórico segue sem identificação)' });
    });
  }

  /** Mesmo telefone no mesmo negócio = mesma pessoa (agendamento online). */
  findByPhone(organizationId: string, phone: string, em = this.repo.manager) {
    return em.getRepository(Client).findOne({
      where: { organizationId, phone: normalizePhone(phone) },
      order: { createdAt: 'ASC' },
    });
  }

  private async find(org: OrgContext, id: string): Promise<Client> {
    const c = await this.repo.findOne({ where: { id, organizationId: org.organizationId } });
    if (!c || c.anonymizedAt) throw new NotFoundException('Cliente não encontrado');
    return c;
  }
}
