import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  can,
  canDeleteRecord,
  cleanAnswers,
  defaultAnamnesis,
  defaultTerm,
  DOCUMENT_LINK_DAYS,
  Feature,
  Permission,
  validateAnswers,
  validateTemplate,
  type ClinicalRecordDto as ClinicalRecordResponse,
  type DocQuestion,
  type DocumentKind,
  type DocumentTemplateDto as TemplateResponse,
  type PatientDocumentDetailDto,
  type PatientDocumentDto,
  type PublicDocumentDto,
} from '@skedulei/contracts';
import { Appointment } from '../agenda/entities/appointment.entity';
import { Client } from '../agenda/entities/client.entity';
import { decryptField, encryptField } from '../common/crypto/field-crypto';
import { Member } from '../organizations/entities/member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import type { OrgContext } from '../organizations/org-context';
import { SecurityEventsService } from '../security/security-events.service';
import type { RequestContext } from '../security/request-context';
import { assertFeature } from '../tenancy/feature-gate';
import { TenantDb } from '../tenancy/tenant-db';
import { ClinicalRecordDto, DocumentTemplateDto, SubmitDocumentDto } from './dto/clinico.dto';
import { ClinicalRecord } from './entities/clinical-record.entity';
import { DocumentTemplate } from './entities/document-template.entity';
import { PatientDocument } from './entities/patient-document.entity';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const FEATURE_OF: Record<DocumentKind, Feature> = { ANAMNESE: Feature.ANAMNESE, TERMO: Feature.TERMOS };

const templateDto = (t: DocumentTemplate): TemplateResponse => ({
  id: t.id,
  kind: t.kind,
  title: t.title,
  questions: t.questions,
  body: t.body,
  active: t.active,
  updatedAt: t.updatedAt.toISOString(),
});

const documentDto = (d: PatientDocument): PatientDocumentDto => ({
  id: d.id,
  clientId: d.clientId,
  kind: d.kind,
  title: d.title,
  status: d.status,
  sentAt: d.createdAt.toISOString(),
  completedAt: d.completedAt?.toISOString() ?? null,
  completedVia: d.completedVia,
  expiresAt: d.expiresAt?.toISOString() ?? null,
});

/** Prontuário, modelos de ficha/termo e documentos dos pacientes. Tudo é dado de saúde: cifrado, com acesso registrado. */
@Injectable()
export class ClinicoService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly events: SecurityEventsService,
  ) {}

  // ---------------------------------------------------------------- prontuário

  async listRecords(org: OrgContext, clientId: string, ctx: RequestContext): Promise<ClinicalRecordResponse[]> {
    const rows = await this.tenant.transaction(async (em) => {
      await assertFeature(em, org.organizationId, Feature.PRONTUARIO);
      await this.client(em, org, clientId);
      return em.getRepository(ClinicalRecord).find({ where: { organizationId: org.organizationId, clientId }, order: { createdAt: 'DESC' }, take: 200 });
    });
    const names = await this.memberNames(rows.map((r) => r.memberId));
    await this.events.record('RECORD_VIEWED', null, ctx, { org: org.organizationId, member: org.memberId, client: clientId });
    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      kind: r.kind,
      title: r.title,
      content: decryptField(r.contentEncrypted),
      authorName: names.get(r.memberId) ?? 'Equipe',
      appointmentId: r.appointmentId,
      createdAt: r.createdAt.toISOString(),
      canDelete: canDeleteRecord(r.createdAt.toISOString(), r.memberId, org.memberId),
    }));
  }

  async createRecord(org: OrgContext, clientId: string, dto: ClinicalRecordDto, ctx: RequestContext): Promise<ClinicalRecordResponse> {
    const saved = await this.tenant.transaction(async (em) => {
      await assertFeature(em, org.organizationId, Feature.PRONTUARIO);
      await this.client(em, org, clientId);
      if (dto.appointmentId) {
        const appt = await em.getRepository(Appointment).findOne({ where: { id: dto.appointmentId, organizationId: org.organizationId, clientId }, select: { id: true } });
        if (!appt) throw new BadRequestException('Esse atendimento não é deste paciente');
      }
      return em.getRepository(ClinicalRecord).save(
        em.getRepository(ClinicalRecord).create({
          organizationId: org.organizationId,
          clientId,
          appointmentId: dto.appointmentId ?? null,
          memberId: org.memberId,
          kind: dto.kind,
          title: dto.title ?? null,
          contentEncrypted: encryptField(dto.content),
        }),
      );
    });
    await this.events.record('RECORD_CREATED', null, ctx, { org: org.organizationId, member: org.memberId, client: clientId, record: saved.id });
    const names = await this.memberNames([saved.memberId]);
    return {
      id: saved.id,
      clientId,
      kind: saved.kind,
      title: saved.title,
      content: dto.content,
      authorName: names.get(saved.memberId) ?? 'Equipe',
      appointmentId: saved.appointmentId,
      createdAt: saved.createdAt.toISOString(),
      canDelete: true,
    };
  }

  async deleteRecord(org: OrgContext, id: string, ctx: RequestContext): Promise<void> {
    const rec = await this.tenant.transaction(async (em) => {
      await assertFeature(em, org.organizationId, Feature.PRONTUARIO);
      const r = await em.getRepository(ClinicalRecord).findOne({ where: { id, organizationId: org.organizationId } });
      if (!r) throw new NotFoundException('Anotação não encontrada');
      if (!canDeleteRecord(r.createdAt.toISOString(), r.memberId, org.memberId)) {
        throw new ForbiddenException('Só quem escreveu apaga, e em até 24 horas. Depois disso a anotação fica registrada.');
      }
      await em.getRepository(ClinicalRecord).delete({ id, organizationId: org.organizationId });
      return r;
    });
    await this.events.record('RECORD_DELETED', null, ctx, { org: org.organizationId, member: org.memberId, client: rec.clientId, record: id });
  }

  // ---------------------------------------------------------------- modelos

  /** Modelos do tipo (os de exemplo nascem na primeira consulta, com o segmento do negócio). */
  async templates(org: OrgContext, kind: DocumentKind): Promise<TemplateResponse[]> {
    const rows = await this.tenant.transaction(async (em) => {
      await assertFeature(em, org.organizationId, FEATURE_OF[kind]);
      // Dois pedidos juntos não criam dois modelos de exemplo.
      await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`doc-templates:${org.organizationId}:${kind}`]);
      const repo = em.getRepository(DocumentTemplate);
      let list = await repo.find({ where: { organizationId: org.organizationId, kind }, order: { createdAt: 'ASC' } });
      if (!list.length) {
        const o = await em.getRepository(Organization).findOneOrFail({ where: { id: org.organizationId }, select: { id: true, name: true, segment: true } });
        const base =
          kind === 'ANAMNESE'
            ? (() => {
                const d = defaultAnamnesis(o.segment);
                return { title: d.title, questions: d.questions, body: null };
              })()
            : (() => {
                const d = defaultTerm(o.name);
                return { title: d.title, questions: [] as DocQuestion[], body: d.body };
              })();
        list = [await repo.save(repo.create({ organizationId: org.organizationId, kind, ...base }))];
      }
      return list;
    });
    return rows.map(templateDto);
  }

  async createTemplate(org: OrgContext, dto: DocumentTemplateDto): Promise<TemplateResponse> {
    const problem = validateTemplate(dto);
    if (problem) throw new BadRequestException(problem);
    return this.tenant.transaction(async (em) => {
      await assertFeature(em, org.organizationId, FEATURE_OF[dto.kind]);
      const repo = em.getRepository(DocumentTemplate);
      return templateDto(
        await repo.save(
          repo.create({ organizationId: org.organizationId, kind: dto.kind, title: dto.title, questions: dto.kind === 'ANAMNESE' ? this.cleanQuestions(dto.questions) : [], body: dto.kind === 'TERMO' ? (dto.body ?? null) : null, active: dto.active ?? true }),
        ),
      );
    });
  }

  async updateTemplate(org: OrgContext, id: string, dto: DocumentTemplateDto): Promise<TemplateResponse> {
    const problem = validateTemplate(dto);
    if (problem) throw new BadRequestException(problem);
    return this.tenant.transaction(async (em) => {
      const repo = em.getRepository(DocumentTemplate);
      const t = await repo.findOne({ where: { id, organizationId: org.organizationId } });
      if (!t) throw new NotFoundException('Modelo não encontrado');
      if (t.kind !== dto.kind) throw new BadRequestException('Não dá para trocar o tipo do modelo');
      await assertFeature(em, org.organizationId, FEATURE_OF[t.kind]);
      Object.assign(t, { title: dto.title, questions: t.kind === 'ANAMNESE' ? this.cleanQuestions(dto.questions) : [], body: t.kind === 'TERMO' ? (dto.body ?? null) : null, active: dto.active ?? t.active });
      return templateDto(await repo.save(t));
    });
  }

  // ---------------------------------------------------------------- documentos do paciente

  async documents(org: OrgContext, clientId: string): Promise<PatientDocumentDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.client(em, org, clientId);
      const rows = await em.getRepository(PatientDocument).find({ where: { organizationId: org.organizationId, clientId }, order: { createdAt: 'DESC' }, take: 50 });
      return rows.map(documentDto);
    });
  }

  /** Cria o pedido com uma cópia do modelo e devolve o link (o código só existe aqui). */
  async send(org: OrgContext, clientId: string, templateId: string, ctx: RequestContext): Promise<PatientDocumentDto> {
    if (!can(org.role, Permission.CLIENTS_MANAGE) && !can(org.role, Permission.CLINICAL_RECORDS)) throw new ForbiddenException('Sem permissão para enviar documentos');
    const token = randomBytes(24).toString('base64url');
    const saved = await this.tenant.transaction(async (em) => {
      await this.client(em, org, clientId);
      const t = await em.getRepository(DocumentTemplate).findOne({ where: { id: templateId, organizationId: org.organizationId, active: true } });
      if (!t) throw new NotFoundException('Modelo não encontrado');
      await assertFeature(em, org.organizationId, FEATURE_OF[t.kind]);
      const repo = em.getRepository(PatientDocument);
      return repo.save(
        repo.create({
          organizationId: org.organizationId,
          clientId,
          templateId: t.id,
          kind: t.kind,
          title: t.title,
          questions: t.questions,
          body: t.body,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + DOCUMENT_LINK_DAYS * 86_400_000),
          status: 'PENDENTE',
          sentByMemberId: org.memberId,
        }),
      );
    });
    await this.events.record('DOCUMENT_SENT', null, ctx, { org: org.organizationId, member: org.memberId, client: clientId, document: saved.id });
    return { ...documentDto(saved), link: `${this.config.get<string>('publicWebUrl')}/documento/${token}` };
  }

  async getDocument(org: OrgContext, id: string, ctx: RequestContext): Promise<PatientDocumentDetailDto> {
    const d = await this.tenant.transaction(async (em) => this.findDocument(em, org, id));
    await this.events.record('DOCUMENT_VIEWED', null, ctx, { org: org.organizationId, member: org.memberId, client: d.clientId, document: id });
    return { ...documentDto(d), questions: d.questions, body: d.body, answers: d.answersEncrypted ? (JSON.parse(decryptField(d.answersEncrypted)) as Record<string, string>) : null, signedName: d.signedName };
  }

  /** A equipe preenche na hora (paciente no balcão). */
  async completeByStaff(org: OrgContext, id: string, dto: SubmitDocumentDto, ctx: RequestContext): Promise<PatientDocumentDto> {
    const saved = await this.tenant.transaction(async (em) => {
      const d = await this.findDocument(em, org, id);
      if (d.status === 'PREENCHIDO') throw new BadRequestException('Este documento já foi preenchido');
      this.fill(d, dto, 'EQUIPE', null);
      return em.getRepository(PatientDocument).save(d);
    });
    await this.events.record('DOCUMENT_COMPLETED', null, ctx, { org: org.organizationId, member: org.memberId, client: saved.clientId, document: id, via: 'EQUIPE' });
    return documentDto(saved);
  }

  async removeDocument(org: OrgContext, id: string): Promise<void> {
    if (!can(org.role, Permission.CLIENTS_MANAGE) && !can(org.role, Permission.CLINICAL_RECORDS)) throw new ForbiddenException('Sem permissão');
    await this.tenant.transaction(async (em) => {
      const d = await em.getRepository(PatientDocument).findOne({ where: { id, organizationId: org.organizationId } });
      if (!d) throw new NotFoundException('Documento não encontrado');
      if (d.status === 'PREENCHIDO') throw new BadRequestException('Documento preenchido fica no histórico do paciente');
      await em.getRepository(PatientDocument).delete({ id, organizationId: org.organizationId });
    });
  }

  // ---------------------------------------------------------------- link público (paciente)

  async publicDocument(token: string): Promise<PublicDocumentDto> {
    const d = await this.byToken(token);
    const org = await this.db.getRepository(Organization).findOneOrFail({ where: { id: d.organizationId }, select: { id: true, name: true } });
    const client = await this.db.getRepository(Client).findOneOrFail({ where: { id: d.clientId }, select: { id: true, name: true } });
    const done = d.status === 'PREENCHIDO';
    return {
      organizationName: org.name,
      kind: d.kind,
      title: d.title,
      // Depois de preenchido, o link não mostra mais nada além do aviso.
      questions: done ? [] : d.questions,
      body: done ? null : d.body,
      patientFirstName: client.name.split(' ')[0],
      completed: done,
    };
  }

  async submitPublic(token: string, dto: SubmitDocumentDto, ip: string | undefined): Promise<{ ok: true }> {
    const d = await this.byToken(token);
    if (d.status === 'PREENCHIDO') throw new BadRequestException('Este documento já foi preenchido. Obrigado!');
    this.fill(d, dto, 'LINK', ip ?? null);
    await this.db.getRepository(PatientDocument).save(d);
    await this.events.record('DOCUMENT_COMPLETED', null, { ip }, { org: d.organizationId, client: d.clientId, document: d.id, via: 'LINK' });
    return { ok: true };
  }

  // ---------------------------------------------------------------- utilitários

  /** Preenche a partir das respostas ou do aceite (valida de acordo com o tipo). */
  private fill(d: PatientDocument, dto: SubmitDocumentDto, via: 'LINK' | 'EQUIPE', ip: string | null) {
    if (d.kind === 'ANAMNESE') {
      const raw = dto.answers ?? {};
      if (Object.values(raw).some((v) => typeof v !== 'string')) throw new BadRequestException('Respostas inválidas');
      const problem = validateAnswers(d.questions, raw);
      if (problem) throw new BadRequestException(problem);
      d.answersEncrypted = encryptField(JSON.stringify(cleanAnswers(d.questions, raw)));
    } else {
      if (dto.accepted !== true) throw new BadRequestException('Marque que você leu e concorda');
      if ((dto.signedName ?? '').trim().length < 3) throw new BadRequestException('Digite o nome completo de quem está aceitando');
      d.signedName = dto.signedName!.trim();
    }
    d.status = 'PREENCHIDO';
    d.completedAt = new Date();
    d.completedVia = via;
    d.completedIp = ip;
  }

  private async byToken(token: string): Promise<PatientDocument> {
    const d = await this.db.getRepository(PatientDocument).findOne({ where: { tokenHash: hash(String(token).slice(0, 100)) } });
    if (!d || (d.status === 'PENDENTE' && d.expiresAt && d.expiresAt.getTime() < Date.now())) throw new NotFoundException('Link não encontrado ou vencido. Peça um novo ao estabelecimento.');
    return d;
  }

  private async findDocument(em: EntityManager, org: OrgContext, id: string): Promise<PatientDocument> {
    const d = await em.getRepository(PatientDocument).findOne({ where: { id, organizationId: org.organizationId } });
    if (!d) throw new NotFoundException('Documento não encontrado');
    return d;
  }

  private async client(em: EntityManager, org: OrgContext, clientId: string) {
    const c = await em.getRepository(Client).findOne({ where: { id: clientId, organizationId: org.organizationId }, select: { id: true, anonymizedAt: true } });
    if (!c || c.anonymizedAt) throw new NotFoundException('Paciente não encontrado');
    return c;
  }

  private async memberNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await this.db.getRepository(Member).find({ where: { id: In(unique) }, select: { id: true, name: true } });
    return new Map(rows.map((m) => [m.id, m.name]));
  }

  /** Perguntas vindas do cliente: ids válidos e únicos, opções aparadas. */
  private cleanQuestions(qs: DocQuestion[] | undefined): DocQuestion[] {
    const seen = new Set<string>();
    return (qs ?? []).map((q) => {
      let id = q.id;
      if (seen.has(id)) id = `q${randomUUID().slice(0, 8)}`;
      seen.add(id);
      return { id, label: q.label.trim(), type: q.type, required: !!q.required, ...(q.type === 'ESCOLHA' ? { options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) } : {}) };
    });
  }
}
