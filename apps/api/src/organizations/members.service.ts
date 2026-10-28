import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Appointment } from '../agenda/entities/appointment.entity';
import {
  canAssignRole,
  MEMBER_COLOR_COUNT,
  MemberStatus,
  Role,
  ROLE_INFO,
  SecurityEventType as Ev,
  type InviteInfoDto,
  type MemberDto,
  type OrganizationSummaryDto,
} from '@agendei/contracts';
import { maskEmail } from '../auth/login-guard';
import { MailService } from '../mail/mail.service';
import type { RequestContext } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { User } from '../users/entities/user.entity';
import { MemberDto as CreateMemberDto, UpdateMemberDto } from './dto/organization.dto';
import { Member } from './entities/member.entity';
import { Organization } from './entities/organization.entity';
import { toMemberDto } from './mappers';
import type { OrgContext } from './org-context';
import { TenantDb } from '../tenancy/tenant-db';

const INVITE_TTL_MS = 7 * 86_400_000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Convite criado e ainda não enviado (o e-mail sai depois do commit). */
export interface PendingInvite {
  member: Member;
  token: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly db: DataSource,
    private readonly mail: MailService,
    private readonly events: SecurityEventsService,
    private readonly config: ConfigService,
  ) {}

  private get repo() {
    return this.tenant.repo(Member);
  }

  private get orgs() {
    return this.tenant.repo(Organization);
  }

  async list(org: OrgContext): Promise<MemberDto[]> {
    const rows = await this.repo.find({ where: { organizationId: org.organizationId, archivedAt: IsNull() }, order: { name: 'ASC' } });
    return rows.map((m) => toMemberDto(m, org.memberId));
  }

  async create(org: OrgContext, dto: CreateMemberDto, ctx: RequestContext = {}): Promise<MemberDto> {
    if (!canAssignRole(org.role, dto.role)) throw new ForbiddenException('Seu perfil não pode dar esse acesso');
    const pending = await this.tenant.transaction((em) => this.add(em, org.organizationId, dto));
    if (pending.token) await this.sendInvite(pending as PendingInvite, org, ctx);
    return toMemberDto(pending.member, org.memberId);
  }

  /**
   * Cria a pessoa na equipe (dentro de uma transação). Com e-mail vira convite;
   * sem e-mail fica SEM_ACESSO — só faz sentido para quem atende (perfil Profissional).
   */
  async add(em: EntityManager, organizationId: string, dto: CreateMemberDto): Promise<{ member: Member; token?: string }> {
    const repo = em.getRepository(Member);
    const email = dto.email ?? null;
    if (!email && dto.role !== Role.PROFISSIONAL) {
      throw new BadRequestException('Para dar esse acesso, informe o e-mail da pessoa');
    }
    if (email && (await repo.exists({ where: { organizationId, email } }))) {
      throw new ConflictException('Já existe alguém da equipe com esse e-mail');
    }
    const color = dto.color ?? ((await repo.count({ where: { organizationId } })) % MEMBER_COLOR_COUNT) + 1;
    const token = email ? randomBytes(32).toString('base64url') : undefined;
    const member = await repo.save(
      repo.create({
        organizationId,
        name: dto.name,
        email,
        phone: dto.phone ?? null,
        role: dto.role,
        bookable: email ? dto.bookable : true,
        color,
        workingHours: dto.workingHours ?? null,
        commissionBps: dto.commissionBps ?? null,
        status: email ? MemberStatus.CONVIDADO : MemberStatus.SEM_ACESSO,
        ...(token ? this.inviteFields(token) : {}),
      }),
    );
    return { member, token };
  }

  async update(org: OrgContext, id: string, dto: UpdateMemberDto, ctx: RequestContext = {}): Promise<MemberDto> {
    const m = await this.findInOrg(org, id);
    if (!canAssignRole(org.role, m.role)) throw new ForbiddenException('Seu perfil não pode alterar essa pessoa');
    if (dto.role && dto.role !== m.role) {
      if (!canAssignRole(org.role, dto.role)) throw new ForbiddenException('Seu perfil não pode dar esse acesso');
      if (m.role === Role.DONO) await this.ensureAnotherOwner(m);
    }

    let newToken: string | undefined;
    if (dto.email !== undefined && dto.email !== m.email) {
      // Quem já entrou no app usa o e-mail da própria conta.
      if (m.status === MemberStatus.ATIVO) throw new BadRequestException('O e-mail de quem já tem acesso não muda por aqui');
      if (dto.email && (await this.repo.exists({ where: { organizationId: org.organizationId, email: dto.email } }))) {
        throw new ConflictException('Já existe alguém da equipe com esse e-mail');
      }
      if (dto.email) {
        newToken = randomBytes(32).toString('base64url');
        Object.assign(m, { email: dto.email, status: MemberStatus.CONVIDADO }, this.inviteFields(newToken));
      } else {
        Object.assign(m, { email: null, status: MemberStatus.SEM_ACESSO, inviteTokenHash: null, inviteExpiresAt: null, invitedAt: null });
      }
    }
    const role = dto.role ?? m.role;
    if (m.status === MemberStatus.SEM_ACESSO && role !== Role.PROFISSIONAL) {
      throw new BadRequestException('Para dar esse acesso, informe o e-mail da pessoa');
    }

    const roleChanged = !!dto.role && dto.role !== m.role;
    Object.assign(m, {
      name: dto.name ?? m.name,
      phone: dto.phone !== undefined ? dto.phone : m.phone,
      role,
      bookable: m.status === MemberStatus.SEM_ACESSO ? true : (dto.bookable ?? m.bookable),
      color: dto.color ?? m.color,
      workingHours: dto.workingHours !== undefined ? dto.workingHours : m.workingHours,
      commissionBps: dto.commissionBps !== undefined ? dto.commissionBps : m.commissionBps,
    });
    const saved = await this.repo.save(m);
    if (roleChanged) await this.events.record(Ev.MEMBER_ROLE_CHANGED, null, ctx, { org: org.organizationId, member: m.id, role });
    if (newToken) await this.sendInvite({ member: saved, token: newToken }, org, ctx);
    return toMemberDto(saved, org.memberId);
  }

  async remove(org: OrgContext, id: string, ctx: RequestContext = {}): Promise<void> {
    const m = await this.findInOrg(org, id);
    if (m.id !== org.memberId && !canAssignRole(org.role, m.role)) {
      throw new ForbiddenException('Seu perfil não pode remover essa pessoa');
    }
    if (m.role === Role.DONO) await this.ensureAnotherOwner(m);
    const archive = () =>
      this.repo.update(
        { id: m.id, organizationId: org.organizationId },
        { userId: null, email: null, status: MemberStatus.SEM_ACESSO, bookable: false, inviteTokenHash: null, archivedAt: new Date() },
      );
    // Com histórico (agenda, comandas, comissões, caixa) a pessoa é arquivada: some da equipe, o nome fica nos registros.
    const hasHistory = await this.tenant.repo(Appointment).exists({ where: { organizationId: org.organizationId, memberId: m.id } });
    if (hasHistory) {
      await archive();
    } else {
      try {
        await this.tenant.transaction(async (em) => {
          await em.query('SAVEPOINT member_delete');
          try {
            await em.getRepository(Member).delete({ id: m.id, organizationId: org.organizationId });
          } catch (err) {
            await em.query('ROLLBACK TO SAVEPOINT member_delete');
            throw err;
          }
        });
      } catch (err) {
        if ((err as { code?: string }).code !== '23503') throw err;
        await archive();
      }
    }
    await this.events.record(Ev.MEMBER_REMOVED, null, ctx, { org: org.organizationId, member: m.id });
  }

  async resendInvite(org: OrgContext, id: string, ctx: RequestContext = {}): Promise<MemberDto> {
    const m = await this.findInOrg(org, id);
    if (m.status !== MemberStatus.CONVIDADO || !m.email) throw new BadRequestException('Essa pessoa não tem convite pendente');
    const token = randomBytes(32).toString('base64url');
    Object.assign(m, this.inviteFields(token));
    const saved = await this.repo.save(m);
    await this.sendInvite({ member: saved, token }, org, ctx);
    return toMemberDto(saved, org.memberId);
  }

  // ---------------------------------------------------------------- convite (lado de quem recebe)

  async inviteInfo(token: string): Promise<InviteInfoDto> {
    const m = await this.findByToken(token);
    const org = await this.orgs.findOneByOrFail({ id: m.organizationId });
    return { organizationName: org.name, segment: org.segment, role: m.role, email: maskEmail(m.email!) };
  }

  /** Aceita o convite com a conta logada. O e-mail da conta precisa ser o convidado. */
  async accept(userId: string, token: string, ctx: RequestContext = {}): Promise<OrganizationSummaryDto> {
    const m = await this.findByToken(token);
    const user = await this.db.getRepository(User).findOneByOrFail({ id: userId });
    if (user.email.toLowerCase() !== m.email) {
      throw new ForbiddenException('Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail.');
    }
    if (await this.repo.exists({ where: { organizationId: m.organizationId, userId } })) {
      throw new ConflictException('Você já faz parte desta equipe');
    }
    await this.db.transaction(async (em) => {
      await em.getRepository(Member).update(m.id, {
        userId,
        status: MemberStatus.ATIVO,
        joinedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      });
      // O link chegou na caixa de entrada: prova que o e-mail é da pessoa.
      if (!user.emailVerifiedAt) await em.getRepository(User).update(userId, { emailVerifiedAt: new Date() });
    });
    await this.events.record(Ev.MEMBER_JOINED, userId, ctx, { org: m.organizationId });
    const org = await this.orgs.findOneByOrFail({ id: m.organizationId });
    return { id: org.id, name: org.name, slug: org.slug, segment: org.segment, role: m.role };
  }

  // ---------------------------------------------------------------- utilitários

  async sendInvite({ member, token }: PendingInvite, org: OrgContext, ctx: RequestContext = {}) {
    const [o, inviter] = await Promise.all([
      this.orgs.findOneByOrFail({ id: org.organizationId }),
      this.repo.findOneBy({ id: org.memberId }),
    ]);
    const url = `${this.config.get<string>('publicWebUrl')}/convite?token=${token}`;
    await this.mail.sendInvite(member.email!, o.name, inviter?.name ?? o.name, ROLE_INFO[member.role].label, url);
    await this.events.record(Ev.MEMBER_INVITED, null, ctx, { org: org.organizationId, member: member.id });
  }

  private inviteFields(token: string) {
    return { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS), invitedAt: new Date() };
  }

  private async findByToken(token: string): Promise<Member> {
    const m = await this.repo.findOne({ where: { inviteTokenHash: hashToken(token), status: MemberStatus.CONVIDADO } });
    if (!m || !m.email || !m.inviteExpiresAt || m.inviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Convite inválido ou expirado. Peça um novo para quem convidou você.');
    }
    return m;
  }

  private async findInOrg(org: OrgContext, id: string): Promise<Member> {
    const m = await this.repo.findOne({ where: { id, organizationId: org.organizationId } });
    if (!m) throw new NotFoundException('Pessoa não encontrada');
    return m;
  }

  /** O negócio nunca fica sem um dono ativo. */
  private async ensureAnotherOwner(m: Member) {
    const owners = await this.repo.count({
      where: { organizationId: m.organizationId, role: Role.DONO, status: MemberStatus.ATIVO },
    });
    if (owners <= 1 && m.status === MemberStatus.ATIVO) {
      throw new BadRequestException('O negócio precisa de pelo menos um dono. Dê o perfil de dono a outra pessoa antes.');
    }
  }
}
