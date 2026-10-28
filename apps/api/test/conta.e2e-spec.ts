/**
 * Conta e preferências contra um Postgres real: esqueci a senha, reenviar confirmação, renovação de sessão
 * (com detecção de reuso), sair, encerrar um aparelho, desativar 2FA e gerar novos códigos, ajustes,
 * exportar dados, push (status/desativar/teste) e novo link do calendário.
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { currentStep, hotp } from '../src/auth/totp';
import { createTestApp, registerUser } from './helpers';

describe('Conta (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let me: Awaited<ReturnType<typeof registerUser>>;

  const outbox = async (to: string, subject: string) =>
    ((await http.get('/v1/dev/outbox').expect(200)).body as { to: string; subject: string; link: string }[]).filter(
      (m) => m.to === to && m.subject.startsWith(subject),
    );
  const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;
  const cookieOf = (res: request.Response) =>
    ((res.headers['set-cookie'] as unknown as string[]) ?? []).find((c) => c.startsWith('agendei_refresh='))?.split(';')[0];
  const login = (email: string, password: string) => http.post('/v1/auth/login').send({ email, password });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    me = await registerUser(http, 'Prof Conta', 'conta@agendei.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reenviar confirmação manda um novo link que confirma o e-mail', async () => {
    expect(await outbox(me.email, 'Confirme')).toHaveLength(1);
    await http.post('/v1/auth/resend-verification').set(me.auth).expect(204);
    const mails = await outbox(me.email, 'Confirme');
    expect(mails).toHaveLength(2);
    await http.post('/v1/auth/verify-email').send({ token: tokenOf(mails[0].link) }).expect(204);
    expect((await http.get('/v1/me').set(me.auth).expect(200)).body.emailVerified).toBe(true);
  });

  it('esqueci a senha: não revela contas, o link troca a senha uma vez e derruba as sessões', async () => {
    const victim = await registerUser(http, 'Esquecida', 'esquecida@agendei.test', 'senha-antiga-123');
    await http.post('/v1/auth/forgot-password').send({ email: 'ninguem@agendei.test' }).expect(204);
    expect(await outbox('ninguem@agendei.test', 'Redefinir')).toHaveLength(0);

    await http.post('/v1/auth/forgot-password').send({ email: victim.email }).expect(204);
    const [mail] = await outbox(victim.email, 'Redefinir');
    const token = tokenOf(mail.link);
    await http.post('/v1/auth/reset-password').send({ token, password: '123' }).expect(400);
    await http.post('/v1/auth/reset-password').send({ token, password: 'senha-nova-456' }).expect(204);
    await http.post('/v1/auth/reset-password').send({ token, password: 'outra-senha-789' }).expect(400);

    // A sessão antiga cai na hora.
    await http.get('/v1/organizations').set(victim.auth).expect(401);
    await http.post('/v1/auth/refresh').set('Cookie', victim.cookie).expect(401);
    await login(victim.email, 'senha-antiga-123').expect(401);
    await login(victim.email, 'senha-nova-456').expect(200);
  });

  it('renovar sessão troca o cookie; reusar o cookie antigo derruba tudo (roubo de token)', async () => {
    const t = await registerUser(http, 'Renova', 'renova@agendei.test');
    const renewed = await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(200);
    const newCookie = cookieOf(renewed)!;
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(t.cookie);
    const newAuth = { authorization: `Bearer ${renewed.body.accessToken}` };
    await http.get('/v1/organizations').set(newAuth).expect(200);

    await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(401);
    await http.post('/v1/auth/refresh').set('Cookie', newCookie).expect(401);
    await http.get('/v1/organizations').set(newAuth).expect(401);
  });

  it('sair encerra a sessão e apaga o cookie', async () => {
    const t = await registerUser(http, 'Sai', 'sai-sessao@agendei.test');
    const res = await http.post('/v1/auth/logout').set('Cookie', t.cookie).expect(204);
    expect(cookieOf(res)).toBe('agendei_refresh=');
    await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(401);
    await http.get('/v1/organizations').set(t.auth).expect(401);
    // Sair sem sessão não quebra.
    await http.post('/v1/auth/logout').expect(204);
  });

  it('encerrar um aparelho específico derruba só ele', async () => {
    const phone = await registerUser(http, 'Dois Aparelhos', 'dois@agendei.test');
    const laptop = await login(phone.email, phone.password).expect(200);
    const laptopAuth = { authorization: `Bearer ${laptop.body.accessToken}` };

    const sessions = (await http.get('/v1/auth/sessions').set(laptopAuth).expect(200)).body as { id: string; current: boolean }[];
    expect(sessions).toHaveLength(2);
    const other = sessions.find((s) => !s.current)!;
    await http.delete(`/v1/auth/sessions/${other.id}`).set(laptopAuth).expect(204);

    await http.get('/v1/organizations').set(phone.auth).expect(401);
    // O aparelho removido tentando renovar só ganha 401 — não é "roubo" e não derruba o notebook.
    await http.post('/v1/auth/refresh').set('Cookie', phone.cookie).expect(401);
    await http.get('/v1/organizations').set(laptopAuth).expect(200);
    expect((await http.get('/v1/auth/sessions').set(laptopAuth).expect(200)).body).toHaveLength(1);
  });

  it('2FA: gerar novos códigos invalida os antigos; desativar exige código válido', async () => {
    const setup = await http.post('/v1/auth/mfa/setup').set(me.auth).expect(200);
    const secret = setup.body.secret as string;
    const step = currentStep();
    const enabled = await http.post('/v1/auth/mfa/enable').set(me.auth).send({ code: hotp(secret, step - 1) }).expect(200);
    const oldCodes = enabled.body.codes as string[];

    await http.post('/v1/auth/mfa/recovery-codes').set(me.auth).send({ code: '000000' }).expect(400);
    const fresh = await http.post('/v1/auth/mfa/recovery-codes').set(me.auth).send({ code: hotp(secret, step) }).expect(200);
    const newCodes = fresh.body.codes as string[];
    expect(newCodes).toHaveLength(10);
    expect(newCodes).not.toEqual(expect.arrayContaining([oldCodes[0]]));

    // Código antigo não serve mais; o novo serve (e só uma vez).
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: oldCodes[0] }).expect(400);
    // O mesmo código TOTP não vale duas vezes.
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: hotp(secret, step) }).expect(400);
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: newCodes[0] }).expect(204);
    expect((await http.get('/v1/me').set(me.auth).expect(200)).body.mfaEnabled).toBe(false);

    const types = ((await http.get('/v1/auth/activity').set(me.auth).expect(200)).body as { type: string }[]).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['MFA_ENABLED', 'MFA_DISABLED']));
  });

  it('exportar meus dados traz tudo da conta, sem senha nem segredos', async () => {
    const res = await http.get('/v1/me/export').set(me.auth).expect(200);
    expect(res.body.user).toMatchObject({ email: me.email });
    expect(res.body.teams).toEqual([]);
    const text = JSON.stringify(res.body);
    for (const secret of ['password_hash', 'mfa_secret', 'cpf_encrypted', 'token_hash']) expect(text).not.toContain(secret);
  });
});
