/**
 * Conta e segurança ponta a ponta contra um Postgres real (banco agendei_test):
 * login, cadastro, 2FA, troca de senha, cabeçalhos e exclusão de conta.
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { currentStep, hotp } from '../src/auth/totp';
import { Organization } from '../src/organizations/entities/organization.entity';
import { User } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';
import { createTestApp, newOrg, quotedTable } from './helpers';

describe('Agendei (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token = '';
  let recoveryCodes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(UsersService).upsert('Prof Teste', 'e2e@agendei.test', 'senha-e2e-123');
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('bloqueia rotas sem login', async () => {
    await http.get('/v1/organizations').expect(401);
  });

  it('faz login e devolve cookie httpOnly', async () => {
    const res = await http.post('/v1/auth/login').send({ email: 'e2e@agendei.test', password: 'senha-e2e-123' }).expect(200);
    token = res.body.accessToken;
    expect(res.headers['set-cookie'][0]).toMatch(/agendei_refresh=.*HttpOnly/);
  });

  let studentId = '';
  it('cadastro público: entra logado, confirma e-mail pelo link e finaliza o cadastro com CPF', async () => {
    const providers = await http.get('/v1/auth/providers').expect(200);
    expect(providers.body).toEqual({ providers: [], signupEnabled: true });

    await http.post('/v1/auth/register').send({ name: 'Nova', email: 'nova@agendei.test', password: '123', acceptTerms: false }).expect(400);
    const reg = await http
      .post('/v1/auth/register')
      .send({ name: 'Nova Pessoa', email: 'nova@agendei.test', password: 'senha-nova-123', acceptTerms: true })
      .expect(201);
    expect(reg.body.user).toMatchObject({ emailVerified: false, profileComplete: false, hasPassword: true });
    await http.post('/v1/auth/register').send({ name: 'X', email: 'NOVA@agendei.test', password: 'senha-nova-123', acceptTerms: true }).expect(400);

    const outbox = await http.get('/v1/dev/outbox').expect(200);
    const link: string = outbox.body.find((m: { subject: string }) => m.subject.startsWith('Confirme')).link;
    await http.post('/v1/auth/verify-email').send({ token: link.split('token=')[1] }).expect(204);

    const novaAuth = { authorization: `Bearer ${reg.body.accessToken}` };
    await http.patch('/v1/me/profile').set(novaAuth).send({ name: 'Nova Pessoa', cpf: '111.111.111-11', phone: '11987654321' }).expect(400);
    const prof = await http
      .patch('/v1/me/profile')
      .set(novaAuth)
      .send({ name: 'Nova Pessoa Silva', cpf: '529.982.247-25', phone: '(11) 98765-4321', state: 'SP' })
      .expect(200);
    expect(prof.body).toMatchObject({ emailVerified: true, profileComplete: true, cpfMasked: '***.982.247-**' });
    expect(JSON.stringify(prof.body)).not.toContain('52998224725');
    // No banco: só cifra + índice cego, nunca o número.
    const db = app.get(DataSource);
    const [row] = await db.query(`SELECT * FROM ${quotedTable(db, User)} WHERE email = 'nova@agendei.test'`);
    expect(JSON.stringify(row)).not.toContain('52998224725');
    expect(row.cpf_encrypted).toMatch(/^v1:/);
  });

  it('2FA: ativa, exige código no login, aceita recuperação uma vez e derruba sessões antigas', async () => {
    const login = () => http.post('/v1/auth/login').send({ email: 'e2e@agendei.test', password: 'senha-e2e-123' });
    const first = await login().expect(200);
    const tokenA = first.body.accessToken as string;
    const authA = { authorization: `Bearer ${tokenA}` };

    const setup = await http.post('/v1/auth/mfa/setup').set(authA).expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    await http.post('/v1/auth/mfa/enable').set(authA).send({ code: '000000' }).expect(400);
    const enabled = await http
      .post('/v1/auth/mfa/enable')
      .set(authA)
      .send({ code: hotp(setup.body.secret, currentStep()) })
      .expect(200);
    expect(enabled.body.codes).toHaveLength(10);
    recoveryCodes = enabled.body.codes;

    // Login agora pede o segundo fator.
    const challenge = await login().expect(200);
    expect(challenge.body).toMatchObject({ mfaRequired: true });
    expect(challenge.body.accessToken).toBeUndefined();
    // O token de 2FA não serve como login.
    await http.get('/v1/organizations').set({ authorization: `Bearer ${challenge.body.mfaToken}` }).expect(401);
    await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: '123456' }).expect(401);
    const recovery = enabled.body.codes[0];
    const ok = await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recovery }).expect(200);
    const authB = { authorization: `Bearer ${ok.body.accessToken}` };
    // Ticket de uso único e código de recuperação de uso único.
    await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recovery }).expect(401);

    const sessions = await http.get('/v1/auth/sessions').set(authB).expect(200);
    expect(sessions.body.length).toBeGreaterThanOrEqual(2);
    expect(sessions.body.filter((x: { current: boolean }) => x.current)).toHaveLength(1);

    // "Sair dos outros aparelhos": o token A deixa de valer na hora.
    await http.post('/v1/auth/sessions/revoke-others').set(authB).expect(204);
    await http.get('/v1/organizations').set(authA).expect(401);
    await http.get('/v1/organizations').set(authB).expect(200);

    const activity = await http.get('/v1/auth/activity').set(authB).expect(200);
    const types = activity.body.map((e: { type: string }) => e.type);
    expect(types).toEqual(expect.arrayContaining(['MFA_ENABLED', 'RECOVERY_CODE_USED', 'SESSION_REVOKED', 'MFA_FAIL']));

    token = ok.body.accessToken;
  });

  it('trocar a senha invalida o access token na hora', async () => {
    const before = { authorization: `Bearer ${token}` };
    await new Promise((r) => setTimeout(r, 1100));
    await http.patch('/v1/auth/password').set(before).send({ currentPassword: 'senha-e2e-123', newPassword: 'senha-e2e-456' }).expect(204);
    await http.get('/v1/organizations').set(before).expect(401);
    // Entra de novo com a senha nova + 2FA (código de recuperação ainda não usado).
    const challenge = await http.post('/v1/auth/login').send({ email: 'e2e@agendei.test', password: 'senha-e2e-456' }).expect(200);
    const ok = await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recoveryCodes[1] }).expect(200);
    token = ok.body.accessToken;
  });

  it('cabeçalhos de segurança na API', async () => {
    const res = await http.get('/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('excluir a conta apaga os dados, o negócio só dela e invalida o token', async () => {
    const reg = await http
      .post('/v1/auth/register')
      .send({ name: 'Sai Daqui', email: 'sai@agendei.test', password: 'senha-sai-123', acceptTerms: true })
      .expect(201);
    const a = { authorization: `Bearer ${reg.body.accessToken}` };
    await http.post('/v1/organizations').set(a).send(newOrg('Salão da Saída')).expect(201);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'outro@x.com', password: 'senha-sai-123' }).expect(400);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'sai@agendei.test', password: 'errada' }).expect(401);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'sai@agendei.test', password: 'senha-sai-123' }).expect(204);
    await http.get('/v1/organizations').set(a).expect(401);
    const db = app.get(DataSource);
    const users = quotedTable(db, User);
    const orgs = quotedTable(db, Organization);
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM ${users} WHERE email = 'sai@agendei.test'`);
    expect(n).toBe(0);
    // Era a única dona e ninguém mais tinha acesso: o negócio sai junto.
    const [{ left }] = await db.query(`SELECT count(*)::int AS left FROM ${orgs} WHERE name = 'Salão da Saída'`);
    expect(left).toBe(0);
  });
});
