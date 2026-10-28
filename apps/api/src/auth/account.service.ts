import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { MemberStatus, Role, SecurityEventType } from '@skedulei/contracts';
import { UsersService } from '../users/users.service';
import type { RequestContext } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { SessionRevocationService } from '../security/session-revocation.service';
import { AuthService } from './auth.service';
import { DeleteAccountDto } from './dto/mfa.dto';
import { AuthIdentity } from './entities/auth-identity.entity';
import { EmailToken } from './entities/email-token.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Member } from '../organizations/entities/member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { SecurityEvent } from '../security/entities/security-event.entity';
import { User } from '../users/entities/user.entity';

/** Tabelas com dados da conta (não do negócio), na ordem segura para apagar. */
const OWNED_ENTITIES = [RefreshToken, EmailToken, MfaRecoveryCode, SecurityEvent, AuthIdentity];

/**
 * Exclusão definitiva da conta (LGPD, art. 18).
 * - Negócio em que a pessoa é a única dona e mais ninguém tem acesso: apagado junto (cascata).
 * - Negócio com outras pessoas ativas: precisa passar o perfil de dono antes.
 * - Nos demais negócios, o cadastro na equipe perde o acesso (o nome fica no histórico do negócio).
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly events: SecurityEventsService,
    private readonly revocation: SessionRevocationService,
    private readonly db: DataSource,
  ) {}

  async deleteAccount(userId: string, dto: DeleteAccountDto, ctx: RequestContext = {}) {
    const t = await this.users.findByIdWithPassword(userId);
    if (dto.confirmEmail.trim().toLowerCase() !== t.email.toLowerCase()) {
      throw new BadRequestException('O e-mail digitado não confere');
    }
    if (t.passwordHash && !(await bcrypt.compare(dto.password ?? '', t.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta');
    }
    if (t.mfaEnabledAt && !(await this.auth.checkSecondFactor(userId, dto.code ?? '', ctx))) {
      throw new UnauthorizedException('Código de verificação inválido');
    }

    const orgsToDelete = await this.soleOwnedOrganizations(userId);

    await this.db.transaction(async (em) => {
      if (orgsToDelete.length) await em.getRepository(Organization).delete({ id: In(orgsToDelete) });
      await em.getRepository(Organization).update({ createdBy: userId }, { createdBy: null });
      await em
        .getRepository(Member)
        .update({ userId }, { userId: null, status: MemberStatus.SEM_ACESSO, email: null, inviteTokenHash: null });
      for (const entity of OWNED_ENTITIES) {
        const table = this.db.getMetadata(entity).tableName;
        await em.query(`DELETE FROM "${table}" WHERE "user_id" = $1`, [userId]);
      }
      const usersTable = this.db.getMetadata(User).tableName;
      await em.query(`DELETE FROM "${usersTable}" WHERE "id" = $1`, [userId]);
    });
    this.revocation.markDeleted(userId);
    // Sem dado pessoal: só um hash para correlacionar com logs, se preciso.
    await this.events.record(SecurityEventType.ACCOUNT_DELETED, null, ctx, {
      ref: createHash('sha256').update(userId).digest('hex').slice(0, 16),
      orgsDeleted: orgsToDelete.length,
    });
  }

  /** Negócios que somem com a conta; recusa se algum tem outras pessoas ativas sem outro dono. */
  private async soleOwnedOrganizations(userId: string): Promise<string[]> {
    const repo = this.db.getRepository(Member);
    const owned = await repo.find({ where: { userId, role: Role.DONO, status: MemberStatus.ATIVO }, relations: { organization: true } });
    const toDelete: string[] = [];
    for (const m of owned) {
      const others = await repo.find({
        where: { organizationId: m.organizationId, status: MemberStatus.ATIVO, id: Not(m.id) },
        select: { id: true, role: true },
      });
      if (others.some((o) => o.role === Role.DONO)) continue;
      if (others.length) {
        throw new BadRequestException(
          `Você é a única pessoa dona de "${m.organization.name}". Dê o perfil de dono a alguém da equipe antes de excluir a conta.`,
        );
      }
      toDelete.push(m.organizationId);
    }
    return toDelete;
  }
}
