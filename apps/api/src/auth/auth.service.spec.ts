import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import type { Repository } from 'typeorm';
import type { MailService } from '../mail/mail.service';
import type { User } from '../users/entities/user.entity';
import type { UsersService } from '../users/users.service';
import type { DataSource } from 'typeorm';
import type { SecurityEventsService } from '../security/security-events.service';
import type { SessionRevocationService } from '../security/session-revocation.service';
import { AuthService, type LoginOutcome } from './auth.service';
import type { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import type { AuthIdentity } from './entities/auth-identity.entity';
import type { EmailToken } from './entities/email-token.entity';
import type { RefreshToken } from './entities/refresh-token.entity';

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/** Repositório em memória mínimo para os testes. */
function memRepo<T extends { id?: string }>(rows: T[]) {
  const match = (r: T, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && '_type' in (v as object) ? (r as Record<string, unknown>)[k] == null : (r as Record<string, unknown>)[k] === v));
  return {
    create: (x: Partial<T>) => x,
    save: jest.fn(async (x: T) => {
      const row = { ...x, id: x.id ?? `id${rows.length}` } as T;
      rows.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => match(r, where)) ?? null),
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where))),
    exists: jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.some((r) => match(r, where))),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
    }),
    update: jest.fn(async (criteria: string | Record<string, unknown>, patch: Partial<T>) => {
      rows.filter((r) => (typeof criteria === 'string' ? r.id === criteria : match(r, criteria))).forEach((r) => Object.assign(r, patch));
    }),
  };
}

describe('AuthService', () => {
  let user: User;
  let usersList: User[];
  let tokens: RefreshToken[];
  let emailTokens: EmailToken[];
  let identities: AuthIdentity[];
  let mails: { kind: string; to: string; url: string }[];
  let service: AuthService;
  let revocation: SessionRevocationService;
  const session = async (p: Promise<LoginOutcome>) => {
    const o = await p;
    if (o.kind !== 'session') throw new Error('esperava sessão');
    return o.session;
  };

  beforeAll(async () => {
    user = { id: 't1', name: 'Filipe', email: 'f@x.com', passwordHash: await bcrypt.hash('senha-forte', 4), emailVerifiedAt: null, mfaEnabledAt: null } as User;
  });

  beforeEach(() => {
    usersList = [{ ...user }];
    tokens = [];
    emailTokens = [];
    identities = [];
    mails = [];
    const byEmail = (e: string) => usersList.find((t) => t.email.toLowerCase() === e.toLowerCase()) ?? null;
    const users = {
      findByEmailWithPassword: jest.fn(async (e: string) => byEmail(e)),
      findByEmail: jest.fn(async (e: string) => byEmail(e)),
      findById: jest.fn(async (id: string) => usersList.find((t) => t.id === id)!),
      findByIdWithPassword: jest.fn(async (id: string) => usersList.find((t) => t.id === id)!),
      createWithPassword: jest.fn(async (name: string, email: string) => {
        const t = { id: `t${usersList.length + 1}`, name, email, passwordHash: 'x', emailVerifiedAt: null } as User;
        usersList.push(t);
        return t;
      }),
      createFromProvider: jest.fn(async (name: string, email: string, verified = true) => {
        const t = { id: `t${usersList.length + 1}`, name, email, passwordHash: null, emailVerifiedAt: verified ? new Date() : null } as User;
        usersList.push(t);
        return t;
      }),
      markEmailVerified: jest.fn(async (id: string) => {
        usersList.find((t) => t.id === id)!.emailVerifiedAt = new Date();
      }),
      setPassword: jest.fn(async () => undefined),
      clearPassword: jest.fn(async (id: string) => {
        usersList.find((t) => t.id === id)!.passwordHash = null;
      }),
      toDto: jest.fn(async (t: User) => ({ id: t.id, name: t.name, email: t.email })),
    } as unknown as UsersService;

    const mail = {
      sendVerification: jest.fn(async (to: string, _n: string, url: string) => mails.push({ kind: 'verify', to, url })),
      sendPasswordReset: jest.fn(async (to: string, url: string) => mails.push({ kind: 'reset', to, url })),
      sendExistingAccount: jest.fn(async (to: string, url: string) => mails.push({ kind: 'existing', to, url })),
    } as unknown as MailService;

    const config = {
      get: (k: string) =>
        ({ jwt: { accessTtlSeconds: 900 }, refreshTtlDays: 30, signupEnabled: true, publicWebUrl: 'https://app.test' })[k],
    } as unknown as ConfigService;

    const events = { record: jest.fn(async () => undefined) } as unknown as SecurityEventsService;
    revocation = { revokeAllFor: jest.fn(async () => undefined), revokeSession: jest.fn() } as unknown as SessionRevocationService;
    service = new AuthService(
      users,
      new JwtService({ secret: 'test' }),
      config,
      mail,
      events,
      revocation,
      {} as DataSource,
      memRepo(tokens) as unknown as Repository<RefreshToken>,
      memRepo(emailTokens) as unknown as Repository<EmailToken>,
      memRepo(identities) as unknown as Repository<AuthIdentity>,
      memRepo([]) as unknown as Repository<MfaRecoveryCode>,
    );
  });

  it('faz login e grava só o hash do refresh token', async () => {
    const s = await session(service.login('f@x.com', 'senha-forte'));
    expect(s.response.accessToken).toBeTruthy();
    expect(tokens[0].tokenHash).toBe(sha(s.refreshToken));
  });

  it('rejeita senha errada e e-mail inexistente com a mesma mensagem', async () => {
    await expect(service.login('f@x.com', 'errada')).rejects.toThrow('E-mail ou senha incorretos');
    await expect(service.login('nao@existe.com', 'x')).rejects.toThrow('E-mail ou senha incorretos');
  });

  it('bloqueia o e-mail após 5 senhas erradas, mesmo com a senha certa depois', async () => {
    for (let i = 0; i < 5; i++) await expect(service.login('f@x.com', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('f@x.com', 'senha-forte')).rejects.toMatchObject({ status: 429 });
  });

  it('rotaciona o refresh e revoga tudo se um token antigo for reusado', async () => {
    const first = await session(service.login('f@x.com', 'senha-forte'));
    const second = await service.refresh(first.refreshToken);
    // A sessão (aparelho) continua a mesma na rotação.
    expect(tokens[1].sessionId).toBe(tokens[0].sessionId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.every((t) => t.revokedAt)).toBe(true);
    // Reuso suspeito invalida também os access tokens já emitidos.
    expect(revocation.revokeAllFor).toHaveBeenCalledWith('t1');
    expect(revocation.revokeSession).toHaveBeenCalledWith(tokens[0].sessionId);
  });

  it('cookie de sessão já encerrada só expira: não é tratado como roubo', async () => {
    const phone = await session(service.login('f@x.com', 'senha-forte'));
    const laptop = await session(service.login('f@x.com', 'senha-forte'));
    await service.logout(phone.refreshToken);
    await expect(service.refresh(phone.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revocation.revokeAllFor).not.toHaveBeenCalled();
    await expect(service.refresh(laptop.refreshToken)).resolves.toBeDefined();
  });

  it('cadastro entra logado, manda o link de confirmação e o link confirma uma vez só', async () => {
    const s = await service.register('Nova', 'nova@x.com', 'senha-nova-1');
    expect(s.response.user.email).toBe('nova@x.com');
    expect(mails[0]).toMatchObject({ kind: 'verify', to: 'nova@x.com' });
    const token = new URL(mails[0].url).searchParams.get('token')!;
    await service.verifyEmail(token);
    expect(usersList.find((t) => t.email === 'nova@x.com')!.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('conta com 2FA: senha certa devolve desafio, não sessão', async () => {
    usersList[0].mfaEnabledAt = new Date();
    const o = await service.login('f@x.com', 'senha-forte');
    expect(o.kind).toBe('mfa');
    expect(tokens).toHaveLength(0);
    usersList[0].mfaEnabledAt = null;
  });

  it('token de 2FA inválido ou de outro propósito é recusado', async () => {
    await expect(service.verifyMfaLogin('lixo', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    const normal = await session(service.login('f@x.com', 'senha-forte'));
    await expect(service.verifyMfaLogin(normal.response.accessToken, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('trocar a senha revoga refresh e access tokens', async () => {
    await session(service.login('f@x.com', 'senha-forte'));
    await service.changePassword('t1', 'senha-forte', 'nova-senha-123');
    expect(tokens.every((t) => t.revokedAt)).toBe(true);
    expect(revocation.revokeAllFor).toHaveBeenCalledWith('t1');
  });

  it('cadastro com e-mail existente avisa o dono e não cria outra conta', async () => {
    await expect(service.register('X', 'F@x.com', 'senha-nova-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(usersList).toHaveLength(1);
    expect(mails[0].kind).toBe('existing');
  });

  it('esqueci a senha não revela se o e-mail existe e o link troca a senha', async () => {
    await service.forgotPassword('ninguem@x.com');
    expect(mails).toHaveLength(0);
    await service.forgotPassword('f@x.com');
    const token = new URL(mails[0].url).searchParams.get('token')!;
    await service.resetPassword(token, 'outra-senha-1');
    await expect(service.resetPassword(token, 'outra-senha-2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login social: cria conta nova, depois reconhece a mesma identidade', async () => {
    const profile = { provider: 'google' as const, providerUserId: 'g1', email: 'social@x.com', name: 'Social', emailVerified: true };
    const a = await service.signInWithProvider(profile);
    expect(a.created).toBe(true);
    const b = await service.signInWithProvider(profile);
    expect(b.created).toBe(false);
    expect(b.outcome.kind).toBe('session');
    expect(usersList.filter((t) => t.email === 'social@x.com')).toHaveLength(1);
  });

  it('login social liga a conta existente só com e-mail verificado pelo provedor', async () => {
    const unverified = { provider: 'microsoft' as const, providerUserId: 'm1', email: 'f@x.com', name: 'F', emailVerified: false };
    await expect(service.signInWithProvider(unverified)).rejects.toMatchObject({ code: 'vincular' });
    const verified = { provider: 'google' as const, providerUserId: 'g2', email: 'f@x.com', name: 'F', emailVerified: true };
    const r = await service.signInWithProvider(verified);
    expect(r.created).toBe(false);
    expect(identities[0]).toMatchObject({ userId: 't1', provider: 'google' });
  });

  it('sequestro prévio: conta criada com e-mail alheio perde senha e logins antigos quando o dono prova o e-mail', async () => {
    // Quem criou a conta com senha (nunca confirmou) e um login Microsoft pendurado nela.
    identities.push({ userId: 't1', provider: 'microsoft', providerUserId: 'atacante' } as AuthIdentity);
    const dono = { provider: 'google' as const, providerUserId: 'g3', email: 'f@x.com', name: 'F', emailVerified: true };
    await service.signInWithProvider(dono);
    expect(usersList[0].passwordHash).toBeNull();
    expect(identities.map((i) => i.provider)).toEqual(['google']);
    expect(revocation.revokeAllFor).toHaveBeenCalled();
  });

  it('login social com e-mail não garantido (Microsoft) cria a conta sem marcar o e-mail como confirmado', async () => {
    const ms = { provider: 'microsoft' as const, providerUserId: 'm9', email: 'novo@x.com', name: 'Novo', emailVerified: false };
    await service.signInWithProvider(ms);
    expect(usersList.find((t) => t.email === 'novo@x.com')!.emailVerifiedAt).toBeNull();
  });
});
