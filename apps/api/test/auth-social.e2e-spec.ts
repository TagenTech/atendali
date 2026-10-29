/**
 * Login social (callback do OAuth com o provedor simulado), 2FA, sessões e exclusão de conta:
 * os caminhos de recusa que o fluxo feliz de `app` e `conta` não visita. Banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ORG_HEADER } from '@skedulei/contracts';
import { currentStep, hotp } from '../src/auth/totp';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;

describe('Login social, 2FA e conta: recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let fetchSpy: jest.SpyInstance;
  let profiles: Record<string, unknown> = {};

  /** Simula Google/Microsoft/Meta: a troca do código devolve um token e o perfil vem de `profiles`. */
  function mockProviders() {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as unknown as Response;
      if (url.includes('/token') || url.includes('access_token')) return json({ access_token: 'tok' });
      if (url.startsWith('https://openidconnect.googleapis.com')) return json(profiles.google);
      if (url.startsWith('https://graph.microsoft.com/oidc')) return json(profiles.microsoft);
      if (url.startsWith('https://graph.microsoft.com/v1.0/me')) return json({});
      if (url.startsWith('https://graph.facebook.com/v19.0/me')) return json(profiles.facebook);
      throw new Error(`fetch inesperado: ${url}`);
    });
  }

  /** Percorre início + callback e devolve a resposta do callback (sempre um redirecionamento). */
  async function social(provider: string) {
    const start = await http.get(`/v1/auth/oauth/${provider}`).expect(302);
    const cookie = (start.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('skedulei_oauth='))!.split(';')[0];
    const state = new URL(start.headers.location).searchParams.get('state')!;
    return http.get(`/v1/auth/oauth/${provider}/callback?code=abc&state=${state}`).set('cookie', cookie).expect(302);
  }
  const refreshCookie = (res: request.Response) => ((res.headers['set-cookie'] as unknown as string[]) ?? []).find((c) => c.startsWith('skedulei_refresh='));

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    process.env.MICROSOFT_CLIENT_ID = 'mid';
    process.env.MICROSOFT_CLIENT_SECRET = 'msecret';
    process.env.FACEBOOK_CLIENT_ID = 'fid';
    process.env.FACEBOOK_CLIENT_SECRET = 'fsecret';
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
  });

  afterAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.FACEBOOK_CLIENT_ID;
    delete process.env.FACEBOOK_CLIENT_SECRET;
    await app?.close();
  });

  beforeEach(() => mockProviders());
  afterEach(() => jest.restoreAllMocks());

  describe('callback do login social', () => {
    it('provedor desconhecido ou desligado volta ao login com código fixo', async () => {
      await http.get('/v1/auth/oauth/twitter').expect(302).expect('location', '/login?erro=provedor');
      const lista = (await http.get('/v1/auth/providers').expect(200)).body;
      expect(lista.providers.sort()).toEqual(['facebook', 'google', 'microsoft']);
    });

    it('cancelar na tela do provedor, cookie ausente e state trocado não entram', async () => {
      await http.get('/v1/auth/oauth/google/callback?error=access_denied').expect(302).expect('location', '/login?erro=cancelado');
      await http.get('/v1/auth/oauth/google/callback?code=abc&state=x').expect(302).expect('location', '/login?erro=falhou');
      const start = await http.get('/v1/auth/oauth/google').expect(302);
      const cookie = (start.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('skedulei_oauth='))!.split(';')[0];
      await http.get('/v1/auth/oauth/google/callback?code=abc&state=outro').set('cookie', cookie).expect(302).expect('location', '/login?erro=falhou');
      await http.get('/v1/auth/oauth/google/callback?state=x').set('cookie', cookie).expect(302).expect('location', '/login?erro=falhou');
      await http.get('/v1/auth/oauth/facebook/callback?code=abc&state=x').set('cookie', cookie).expect(302).expect('location', '/login?erro=falhou');
      await http.get('/v1/auth/oauth/twitter/callback?code=abc&state=x').set('cookie', cookie).expect(302).expect('location', '/login?erro=falhou');
    });

    it('conta nova pelo Google: boas-vindas na primeira vez, direto no app nas seguintes', async () => {
      profiles.google = { sub: 'g-nova', email: 'Nova.Social@Skedulei.test', email_verified: true, name: 'Nova Social' };
      const first = await social('google');
      expect(first.headers.location).toBe('/hoje?bemvindo=1');
      expect(refreshCookie(first)).toBeTruthy();
      const again = await social('google');
      expect(again.headers.location).toBe('/hoje');
    });

    it('sem nome no perfil o nome vem do e-mail', async () => {
      profiles.google = { sub: 'g-sem-nome', email: 'sem.nome@skedulei.test', email_verified: true };
      await social('google').then((r) => expect(r.headers.location).toBe('/hoje?bemvindo=1'));
      const [row] = await db.query(`SELECT name FROM "${db.getMetadata('User').tableName}" WHERE email = 'sem.nome@skedulei.test'`);
      expect(row.name).toBe('sem.nome');
    });

    it('Microsoft não liga conta existente (e-mail não garantido) e Meta sem e-mail é recusada', async () => {
      await registerUser(http, 'Já Tenho Conta', 'ja-tenho@skedulei.test');
      profiles.microsoft = { sub: 'm1', email: 'ja-tenho@skedulei.test', name: 'Outra Pessoa' };
      await social('microsoft').then((r) => expect(r.headers.location).toBe('/login?erro=vincular'));
      profiles.facebook = { id: 'f1', name: 'Sem Email' };
      await social('facebook').then((r) => expect(r.headers.location).toBe('/login?erro=email'));
    });

    it('com 2FA ligado o social pede o código no fragmento da URL (nunca na query)', async () => {
      const s = await registerUser(http, 'Com Duas Etapas', 'duas-etapas@skedulei.test');
      const setup = (await http.post('/v1/auth/mfa/setup').set(s.auth).expect(200)).body;
      await http.post('/v1/auth/mfa/enable').set(s.auth).send({ code: hotp(setup.secret, currentStep()) }).expect(200);
      profiles.google = { sub: 'g-2fa', email: 'duas-etapas@skedulei.test', email_verified: true, name: 'Com Duas Etapas' };
      const r = await social('google');
      expect(r.headers.location).toMatch(/^\/login\/2fa#t=/);
      expect(refreshCookie(r)).toBeUndefined();
    });

    it('cadastro fechado: quem não tem conta não entra pelo provedor', async () => {
      const config = app.get(ConfigService);
      const original = config.get.bind(config);
      jest.spyOn(config, 'get').mockImplementation(((k: string) => (k === 'signupEnabled' ? false : original(k))) as never);
      profiles.google = { sub: 'g-fechado', email: 'fechado@skedulei.test', email_verified: true, name: 'Fechado' };
      await social('google').then((r) => expect(r.headers.location).toBe('/login?erro=fechado'));
      await http.post('/v1/auth/register').send({ name: 'Fechado', email: 'fechado2@skedulei.test', password: 'senha-forte-123', acceptTerms: true }).expect(400);
    });

    it('falha do provedor na troca do código volta com código fixo', async () => {
      fetchSpy.mockImplementation(async () => ({ ok: false, status: 500, text: async () => 'erro', json: async () => ({}) }) as unknown as Response);
      await social('google').then((r) => expect(r.headers.location).toBe('/login?erro=falhou'));
    });
  });

  describe('sessões e senha', () => {
    let s: Session;
    beforeAll(async () => {
      s = await registerUser(http, 'Sessões', 'sessoes@skedulei.test');
    });

    it('renovar sem cookie, com cookie inventado ou vencido não funciona', async () => {
      await http.post('/v1/auth/refresh').expect(401);
      await http.post('/v1/auth/refresh').set('cookie', 'skedulei_refresh=inventado').expect(401);
      await db.query(`UPDATE ${quotedTable(db, RefreshToken)} SET expires_at = now() - interval '1 day' WHERE user_id = $1`, [s.id]);
      await http.post('/v1/auth/refresh').set('cookie', s.cookie).expect(401);
    });

    it('sair com cookie inventado é inofensivo', async () => {
      await http.post('/v1/auth/logout').set('cookie', 'skedulei_refresh=inventado').expect(204);
      await http.post('/v1/auth/logout').expect(204);
    });

    it('reenviar confirmação de quem já confirmou não manda nada', async () => {
      const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
      const link = outbox.find((m) => m.to === 'sessoes@skedulei.test' && m.link?.includes('verificar-email'))!.link!;
      await http.post('/v1/auth/verify-email').send({ token: link.split('token=')[1] }).expect(204);
      const before = (await http.get('/v1/dev/outbox').expect(200)).body.length;
      await http.post('/v1/auth/resend-verification').set(s.auth).expect(204);
      expect((await http.get('/v1/dev/outbox').expect(200)).body.length).toBe(before);
    });

    it('trocar a senha pede a atual correta', async () => {
      await http.patch('/v1/auth/password').set(s.auth).send({ currentPassword: 'errada-errada', newPassword: 'outra-senha-forte-1' }).expect(401);
      await http.patch('/v1/auth/password').set(s.auth).send({ newPassword: 'outra-senha-forte-1' }).expect(401);
    });

    it('configurações da conta: muda só o que veio', async () => {
      const r = await http.patch('/v1/me/settings').set(s.auth).send({ name: 'Sessões Novas', timezone: 'America/Manaus' }).expect(200);
      expect(r.body.name).toBe('Sessões Novas');
      const vazio = await http.patch('/v1/me/settings').set(s.auth).send({}).expect(200);
      expect(vazio.body.name).toBe('Sessões Novas');
    });

    it('finalizar cadastro: o mesmo CPF não vale em duas contas', async () => {
      const outra = await registerUser(http, 'Outra Conta', 'outra-conta-cpf@skedulei.test');
      await http.patch('/v1/me/profile').set(s.auth).send({ name: 'Sessões Novas', cpf: '529.982.247-25', phone: '(11) 98765-4321' }).expect(200);
      await http.patch('/v1/me/profile').set(outra.auth).send({ name: 'Outra Conta', cpf: '529.982.247-25', phone: '(11) 98765-4322' }).expect(409);
    });
  });

  describe('2FA: recusas', () => {
    let s: Session;
    let secret = '';
    beforeAll(async () => {
      s = await registerUser(http, 'Dupla Etapa', 'dupla-etapa@skedulei.test');
    });

    it('ativar sem iniciar, desligar sem 2FA e gerar códigos sem 2FA são recusados', async () => {
      await http.post('/v1/auth/mfa/enable').set(s.auth).send({ code: '123456' }).expect(400);
      await http.post('/v1/auth/mfa/disable').set(s.auth).send({ code: '123456' }).expect(400);
      await http.post('/v1/auth/mfa/recovery-codes').set(s.auth).send({ code: '123456' }).expect(400);
    });

    it('ativa e não deixa configurar de novo; o login trava depois de 5 códigos errados', async () => {
      const setup = (await http.post('/v1/auth/mfa/setup').set(s.auth).expect(200)).body;
      secret = setup.secret;
      await http.post('/v1/auth/mfa/enable').set(s.auth).send({ code: hotp(secret, currentStep()) }).expect(200);
      await http.post('/v1/auth/mfa/setup').set(s.auth).expect(400);

      const challenge = (await http.post('/v1/auth/login').send({ email: s.email, password: s.password }).expect(200)).body;
      for (let i = 0; i < 5; i++) await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.mfaToken, code: '000000' }).expect(401);
      const travado = await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.mfaToken, code: '000000' }).expect(429);
      expect(travado.body.message).toMatch(/Muitas tentativas/);
    });

    it('ticket inválido, vencido ou que é um token de acesso não vale', async () => {
      await http.post('/v1/auth/mfa/verify').send({ mfaToken: 'lixo', code: '123456' }).expect(401);
      await http.post('/v1/auth/mfa/verify').send({ mfaToken: s.token, code: '123456' }).expect(401);
    });

    it('excluir a conta com 2FA pede o código', async () => {
      const body = { confirmEmail: s.email, password: s.password };
      await http.post('/v1/auth/delete-account').set(s.auth).send(body).expect(401);
      await http.post('/v1/auth/delete-account').set(s.auth).send({ ...body, code: '000000' }).expect(401);
    });
  });

  describe('excluir a conta com negócio compartilhado', () => {
    it('com outro dono o negócio fica; sozinho com equipe, o app pede para passar o cargo', async () => {
      const dono = await registerUser(http, 'Dono Um', 'dono-um@skedulei.test');
      const org = (await http.post('/v1/organizations').set(dono.auth).send(newOrg('Salão Dois Donos', { team: [{ name: 'Sócia', email: 'socia@skedulei.test', role: 'DONO', bookable: false }] })).expect(201)).body;
      const inOrg = { ...dono.auth, [ORG_HEADER]: org.id };
      const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
      const token = box.find((m) => m.to === 'socia@skedulei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
      const socia = await registerUser(http, 'Sócia', 'socia@skedulei.test');
      await http.post('/v1/invites/accept').set(socia.auth).send({ token }).expect(201);
      expect((await http.get('/v1/org/members').set(inOrg).expect(200)).body.length).toBeGreaterThanOrEqual(2);

      await http.post('/v1/auth/delete-account').set(dono.auth).send({ confirmEmail: dono.email, password: dono.password }).expect(204);
      const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM "${db.getMetadata('Organization').tableName}" WHERE id = $1`, [org.id]);
      expect(n).toBe(1);

      // Agora a sócia é a única dona e há alguém mais na equipe: precisa passar o cargo antes.
      await http.post('/v1/org/members').set({ ...socia.auth, [ORG_HEADER]: org.id }).send({ name: 'Recepção', email: 'recepcao-dois@skedulei.test', role: 'RECEPCAO', bookable: false }).expect(201);
      const box2 = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
      const token2 = box2.find((m) => m.to === 'recepcao-dois@skedulei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
      const rec = await registerUser(http, 'Recepção', 'recepcao-dois@skedulei.test');
      await http.post('/v1/invites/accept').set(rec.auth).send({ token: token2 }).expect(201);
      const recusa = await http.post('/v1/auth/delete-account').set(socia.auth).send({ confirmEmail: socia.email, password: socia.password }).expect(400);
      expect(recusa.body.message).toMatch(/única pessoa dona/);
    });
  });
});
