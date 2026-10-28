import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  deviceLabel,
  SecurityEventType as Ev,
  type AuthProvider,
  type AuthResponse,
  type MfaSetupDto,
  type SessionDto,
} from '@skedulei/contracts';
import type { AppConfig } from '../config/configuration';
import { decryptField, encryptField } from '../common/crypto/field-crypto';
import type { JwtPayload } from '../common/types/jwt-payload';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { BCRYPT_ROUNDS, UsersService } from '../users/users.service';
import type { RequestContext } from '../security/request-context';
import { maskIp, SecurityEventsService } from '../security/security-events.service';
import { SessionRevocationService } from '../security/session-revocation.service';
import { AuthIdentity } from './entities/auth-identity.entity';
import { EmailToken, type EmailTokenType } from './entities/email-token.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginAttempts, maskEmail } from './login-guard';
import { generateRecoveryCodes, generateSecret, normalizeRecoveryCode, otpauthUrl, verifyTotp } from './totp';

/** Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('skedulei-dummy', BCRYPT_ROUNDS));

const VERIFY_TTL_MS = 3 * 86_400_000;
const RESET_TTL_MS = 3_600_000;
const MFA_TOKEN_TTL_S = 300;

export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Resultado de um login: sessão pronta ou desafio de 2FA. */
export type LoginOutcome = { kind: 'session'; session: IssuedSession } | { kind: 'mfa'; mfaToken: string };

export interface ProviderProfile {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Erro do login social com código fixo (a tela de login traduz; nada de texto livre na URL). */
export class OAuthError extends Error {
  constructor(readonly code: 'email' | 'vincular' | 'fechado' | 'falhou') {
    super(code);
  }
}

@Injectable()
export class AuthService {
  private readonly attempts = new LoginAttempts();
  private readonly mfaAttempts = new LoginAttempts();
  private readonly usedMfaTokens = new Map<string, number>();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly events: SecurityEventsService,
    private readonly revocation: SessionRevocationService,
    private readonly db: DataSource,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(EmailToken) private readonly emailTokens: Repository<EmailToken>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(MfaRecoveryCode) private readonly recoveryCodes: Repository<MfaRecoveryCode>,
  ) {}

  // ---------------------------------------------------------------- login

  async login(email: string, password: string, ctx: RequestContext = {}): Promise<LoginOutcome> {
    const locked = this.attempts.lockedFor(email);
    if (locked) {
      throw new HttpException(
        `Muitas tentativas. Tente de novo em ${locked} min ou use "Esqueci minha senha".`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.users.findByEmailWithPassword(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !user.passwordHash || !ok) {
      const justLocked = this.attempts.fail(email);
      await this.events.record(justLocked ? Ev.LOGIN_LOCKED : Ev.LOGIN_FAIL, user?.id ?? null, ctx, user ? undefined : { email: maskEmail(email) });
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    this.attempts.success(email);
    return this.afterPrimaryAuth(user, ctx);
  }

  /** Senha (ou social) ok: se tem 2FA, devolve o desafio; senão, a sessão. */
  private async afterPrimaryAuth(user: User, ctx: RequestContext, via = 'password'): Promise<LoginOutcome> {
    if (user.mfaEnabledAt) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, email: user.email, purpose: 'mfa', jti: randomUUID() } satisfies JwtPayload & { jti: string },
        { expiresIn: MFA_TOKEN_TTL_S },
      );
      return { kind: 'mfa', mfaToken };
    }
    await this.events.record(Ev.LOGIN_OK, user.id, ctx, { via });
    return { kind: 'session', session: await this.issue(user, ctx) };
  }

  /** Segundo passo do login: código do app autenticador ou de recuperação. */
  async verifyMfaLogin(mfaToken: string, code: string, ctx: RequestContext = {}): Promise<IssuedSession> {
    let p: JwtPayload & { jti?: string };
    try {
      p = await this.jwt.verifyAsync(mfaToken, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('O tempo para o código acabou. Entre de novo.');
    }
    if (p.purpose !== 'mfa' || !p.jti || this.usedMfaTokens.has(p.jti)) {
      throw new UnauthorizedException('O tempo para o código acabou. Entre de novo.');
    }
    const key = `mfa:${p.sub}`;
    const locked = this.mfaAttempts.lockedFor(key);
    if (locked) throw new HttpException(`Muitas tentativas. Tente em ${locked} min.`, HttpStatus.TOO_MANY_REQUESTS);

    const user = await this.users.findById(p.sub);
    if (!(await this.checkSecondFactor(user.id, code, ctx))) {
      this.mfaAttempts.fail(key);
      await this.events.record(Ev.MFA_FAIL, user.id, ctx);
      throw new UnauthorizedException('Código inválido');
    }
    this.mfaAttempts.success(key);
    this.usedMfaTokens.set(p.jti, Date.now() + MFA_TOKEN_TTL_S * 1000);
    for (const [k, exp] of this.usedMfaTokens) if (exp < Date.now()) this.usedMfaTokens.delete(k);
    await this.events.record(Ev.LOGIN_OK, user.id, ctx, { via: 'mfa' });
    return this.issue(user, ctx);
  }

  // ---------------------------------------------------------------- cadastro e e-mail

  async register(name: string, email: string, password: string, ctx: RequestContext = {}): Promise<IssuedSession> {
    if (!this.config.get<boolean>('signupEnabled')) throw new BadRequestException('Cadastro fechado no momento');
    const existing = await this.users.findByEmail(email);
    if (existing) {
      // Não cria outra conta; avisa o dono do e-mail (pode não ter sido ele).
      await this.mail.sendExistingAccount(existing.email, `${this.webUrl()}/login`);
      throw new BadRequestException('Esse e-mail já tem conta. Entre ou recupere a senha.');
    }
    const user = await this.users.createWithPassword(name, email, password);
    await this.events.record(Ev.SIGNUP, user.id, ctx);
    await this.sendVerification(user);
    return this.issue(user, ctx);
  }

  async resendVerification(userId: string) {
    const t = await this.users.findById(userId);
    if (t.emailVerifiedAt) return;
    await this.sendVerification(t);
  }

  async verifyEmail(token: string, ctx: RequestContext = {}): Promise<void> {
    const row = await this.consume(token, 'VERIFY');
    await this.users.markEmailVerified(row.userId);
    await this.events.record(Ev.EMAIL_VERIFIED, row.userId, ctx);
  }

  /** Sempre responde igual, exista ou não a conta (não revela e-mails cadastrados). */
  async forgotPassword(email: string, ctx: RequestContext = {}): Promise<void> {
    const t = await this.users.findByEmail(email);
    if (!t) return;
    const token = await this.createToken(t.id, 'RESET', RESET_TTL_MS);
    await this.events.record(Ev.PASSWORD_RESET_REQUESTED, t.id, ctx);
    await this.mail.sendPasswordReset(t.email, `${this.webUrl()}/redefinir-senha?token=${token}`);
  }

  async resetPassword(token: string, password: string, ctx: RequestContext = {}): Promise<void> {
    const row = await this.consume(token, 'RESET');
    await this.users.setPassword(row.userId, password);
    // Quem recebeu o link no e-mail provou ser dono dele.
    await this.users.markEmailVerified(row.userId);
    await this.revokeEverything(row.userId);
    await this.events.record(Ev.PASSWORD_RESET, row.userId, ctx);
  }

  // ---------------------------------------------------------------- login social

  /** Acha pela identidade, depois pelo e-mail (liga as contas), senão cria. */
  async signInWithProvider(profile: ProviderProfile, ctx: RequestContext = {}): Promise<{ outcome: LoginOutcome; created: boolean }> {
    const identity = await this.identities.findOne({
      where: { provider: profile.provider, providerUserId: profile.providerUserId },
    });
    let user: User | null = identity ? await this.users.findById(identity.userId) : null;
    let created = false;
    if (!user) {
      const byEmail = await this.users.findByEmail(profile.email);
      if (byEmail) {
        // Só liga a uma conta existente se o provedor garante o e-mail.
        if (!profile.emailVerified) throw new OAuthError('vincular');
        user = byEmail;
        if (!user.emailVerifiedAt) {
          // Conta que nunca confirmou o e-mail pode ter sido criada por outra pessoa (sequestro prévio): quem prova
          // ser o dono do e-mail agora fica com a conta, e a senha, os logins sociais e as sessões antigas caem.
          await this.identities.delete({ userId: user.id });
          await this.users.clearPassword(user.id);
          await this.revokeEverything(user.id);
          await this.users.markEmailVerified(user.id);
        }
      } else {
        if (!this.config.get<boolean>('signupEnabled')) throw new OAuthError('fechado');
        user = await this.users.createFromProvider(profile.name || profile.email.split('@')[0], profile.email, profile.emailVerified);
        created = true;
      }
      await this.identities.save(
        this.identities.create({ userId: user.id, provider: profile.provider, providerUserId: profile.providerUserId, email: profile.email }),
      );
      await this.events.record(created ? Ev.OAUTH_CREATED : Ev.OAUTH_LINKED, user.id, ctx, { provider: profile.provider });
    }
    return { outcome: await this.afterPrimaryAuth(user, ctx, profile.provider), created };
  }

  // ---------------------------------------------------------------- sessões

  async refresh(rawToken: string | undefined, ctx: RequestContext = {}): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException('Sessão expirada');
    const stored = await this.refreshRepo.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!stored) throw new UnauthorizedException('Sessão expirada');

    if (stored.revokedAt) {
      // Token já trocado sendo reutilizado enquanto a sessão segue viva (outro aparelho tem o sucessor):
      // possível roubo — derruba todas as sessões. Sessão encerrada (sair, aparelho removido, senha trocada)
      // é só expirada: não pode derrubar os outros aparelhos.
      const stillActive = await this.refreshRepo.exists({ where: { sessionId: stored.sessionId, revokedAt: IsNull() } });
      if (stillActive) {
        await this.events.record(Ev.TOKEN_REUSE, stored.userId, ctx);
        await this.revokeEverything(stored.userId);
      }
      throw new UnauthorizedException('Sessão expirada');
    }
    if (stored.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Sessão expirada');

    await this.refreshRepo.update(stored.id, { revokedAt: new Date() });
    const user = await this.users.findById(stored.userId);
    return this.issue(user, ctx, { sessionId: stored.sessionId, startedAt: stored.sessionStartedAt });
  }

  async logout(rawToken: string | undefined, ctx: RequestContext = {}): Promise<void> {
    if (!rawToken) return;
    const row = await this.refreshRepo.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!row) return;
    await this.endSession(row.userId, row.sessionId);
    await this.events.record(Ev.LOGOUT, row.userId, ctx);
  }

  async listSessions(userId: string, currentSid?: string): Promise<SessionDto[]> {
    const rows = await this.refreshRepo.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.sessionId) ? false : (seen.add(r.sessionId), true)))
      .map((r) => ({
        id: r.sessionId,
        device: deviceLabel(r.userAgent),
        ip: maskIp(r.ip),
        lastActiveAt: r.createdAt.toISOString(),
        startedAt: r.sessionStartedAt.toISOString(),
        current: r.sessionId === currentSid,
      }));
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestContext = {}) {
    await this.endSession(userId, sessionId);
    await this.events.record(Ev.SESSION_REVOKED, userId, ctx, { scope: 'one' });
  }

  async revokeOtherSessions(userId: string, currentSid: string | undefined, ctx: RequestContext = {}) {
    const rows = await this.refreshRepo.find({ where: { userId, revokedAt: IsNull() }, select: { sessionId: true } });
    for (const sid of new Set(rows.map((r) => r.sessionId))) {
      if (sid !== currentSid) await this.endSession(userId, sid);
    }
    await this.events.record(Ev.SESSION_REVOKED, userId, ctx, { scope: 'others' });
  }

  private async endSession(userId: string, sessionId: string) {
    await this.refreshRepo.update({ userId, sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
    this.revocation.revokeSession(sessionId);
  }

  /** Senha trocada/redefinida, reuso suspeito: nenhum token antigo vale mais. */
  private async revokeEverything(userId: string) {
    // O corte por professor é em segundos (iat do JWT); a revogação por sessão pega também
    // os tokens emitidos no mesmo segundo (ex.: o ladrão que acabou de renovar).
    const active = await this.refreshRepo.find({ where: { userId, revokedAt: IsNull() }, select: { sessionId: true } });
    for (const sid of new Set(active.map((r) => r.sessionId))) this.revocation.revokeSession(sid);
    await this.refreshRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.revocation.revokeAllFor(userId);
  }

  /** Quem entrou só pelo Google etc. pode criar uma senha sem informar a atual. */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string, ctx: RequestContext = {}) {
    const user = await this.users.findByIdWithPassword(userId);
    if (user.passwordHash && !(await bcrypt.compare(currentPassword ?? '', user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.users.setPassword(userId, newPassword);
    await this.revokeEverything(userId);
    await this.events.record(Ev.PASSWORD_CHANGED, userId, ctx);
  }

  // ---------------------------------------------------------------- 2FA

  async mfaSetup(userId: string): Promise<MfaSetupDto> {
    const t = await this.users.findById(userId);
    if (t.mfaEnabledAt) throw new BadRequestException('A verificação em duas etapas já está ativa');
    const secret = generateSecret();
    await this.db.getRepository(User).update(userId, { mfaPendingSecretEncrypted: encryptField(secret) });
    return { secret, otpauthUrl: otpauthUrl(secret, t.email) };
  }

  async mfaEnable(userId: string, code: string, ctx: RequestContext = {}): Promise<string[]> {
    const row = await this.db
      .getRepository(User)
      .createQueryBuilder('t')
      .addSelect('t.mfaPendingSecretEncrypted')
      .where('t.id = :id', { id: userId })
      .getOne();
    if (!row?.mfaPendingSecretEncrypted) throw new BadRequestException('Comece a configuração de novo');
    const secret = decryptField(row.mfaPendingSecretEncrypted);
    const step = verifyTotp(secret, code.trim());
    if (step === null) throw new BadRequestException('Código inválido — confira o horário do celular e tente o código atual');
    await this.db.getRepository(User).update(userId, {
      mfaSecretEncrypted: row.mfaPendingSecretEncrypted,
      mfaPendingSecretEncrypted: null,
      mfaEnabledAt: new Date(),
      mfaLastStep: String(step),
    });
    await this.events.record(Ev.MFA_ENABLED, userId, ctx);
    return this.newRecoveryCodes(userId);
  }

  async mfaDisable(userId: string, code: string, ctx: RequestContext = {}) {
    if (!(await this.checkSecondFactor(userId, code, ctx))) throw new BadRequestException('Código inválido');
    await this.db.getRepository(User).update(userId, {
      mfaSecretEncrypted: null,
      mfaPendingSecretEncrypted: null,
      mfaEnabledAt: null,
      mfaLastStep: null,
    });
    await this.recoveryCodes.delete({ userId });
    await this.events.record(Ev.MFA_DISABLED, userId, ctx);
  }

  async regenerateRecoveryCodes(userId: string, code: string, ctx: RequestContext = {}): Promise<string[]> {
    if (!(await this.checkSecondFactor(userId, code, ctx))) throw new BadRequestException('Código inválido');
    return this.newRecoveryCodes(userId);
  }

  private async newRecoveryCodes(userId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await this.recoveryCodes.delete({ userId });
    await this.recoveryCodes.insert(codes.map((c) => ({ userId, codeHash: hashToken(normalizeRecoveryCode(c)), usedAt: null })));
    return codes;
  }

  /** Código TOTP (sem reuso do mesmo passo) ou código de recuperação (uso único). */
  async checkSecondFactor(userId: string, code: string, ctx: RequestContext = {}): Promise<boolean> {
    const row = await this.db
      .getRepository(User)
      .createQueryBuilder('t')
      .addSelect(['t.mfaSecretEncrypted', 't.mfaLastStep'])
      .where('t.id = :id', { id: userId })
      .getOne();
    if (!row?.mfaSecretEncrypted) return false;
    const clean = code.trim();
    if (/^\d{6}$/.test(clean)) {
      const step = verifyTotp(decryptField(row.mfaSecretEncrypted), clean, Date.now(), Number(row.mfaLastStep ?? -1));
      if (step === null) return false;
      await this.db.getRepository(User).update(userId, { mfaLastStep: String(step) });
      return true;
    }
    const hit = await this.recoveryCodes.findOne({ where: { userId, codeHash: hashToken(normalizeRecoveryCode(clean)), usedAt: IsNull() } });
    if (!hit) return false;
    await this.recoveryCodes.update(hit.id, { usedAt: new Date() });
    await this.events.record(Ev.RECOVERY_CODE_USED, userId, ctx);
    return true;
  }

  // ---------------------------------------------------------------- utilitários

  private async sendVerification(t: User) {
    const token = await this.createToken(t.id, 'VERIFY', VERIFY_TTL_MS);
    await this.mail.sendVerification(t.email, t.name, `${this.webUrl()}/verificar-email?token=${token}`);
  }

  private async createToken(userId: string, type: EmailTokenType, ttl: number): Promise<string> {
    // Um link válido por vez de cada tipo.
    await this.emailTokens.update({ userId, type, usedAt: IsNull() }, { usedAt: new Date() });
    const token = randomBytes(32).toString('base64url');
    await this.emailTokens.save(
      this.emailTokens.create({ userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttl), usedAt: null }),
    );
    return token;
  }

  private async consume(token: string, type: EmailTokenType): Promise<EmailToken> {
    const row = await this.emailTokens.findOne({ where: { tokenHash: hashToken(token), type } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado. Peça um novo.');
    }
    await this.emailTokens.update(row.id, { usedAt: new Date() });
    return row;
  }

  private webUrl() {
    return this.config.get<string>('publicWebUrl')!;
  }

  async issue(user: User, ctx: RequestContext = {}, session?: { sessionId: string; startedAt: Date }): Promise<IssuedSession> {
    const { accessTtlSeconds } = this.config.get<AppConfig['jwt']>('jwt')!;
    const refreshTtlDays = this.config.get<number>('refreshTtlDays')!;
    const sessionId = session?.sessionId ?? randomUUID();

    const payload: JwtPayload = { sub: user.id, email: user.email, sid: sessionId };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtlSeconds });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        sessionId,
        sessionStartedAt: session?.startedAt ?? new Date(),
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: ctx.userAgent?.slice(0, 255) ?? null,
        ip: ctx.ip ?? null,
        revokedAt: null,
      }),
    );

    return {
      response: { accessToken, expiresIn: accessTtlSeconds, user: await this.users.toDto(user) },
      refreshToken,
      refreshExpiresAt,
    };
  }
}
