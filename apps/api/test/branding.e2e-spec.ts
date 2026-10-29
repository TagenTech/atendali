/** Personalização da página pública: logo, fundo, cor e frase (banco skedulei_test). */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ORG_HEADER } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const png = `data:image/png;base64,${PNG}`;

describe('Personalização visual (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let pro: Session;
  let orgId = '';
  let slug = '';
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Visual', 'dona-visual@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(newOrg('Salão Visual', { team: [{ name: 'Pro Visual', email: 'pro-visual@skedulei.test', role: 'PROFISSIONAL', bookable: true }] }))
      .expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = outbox.find((m) => m.to === 'pro-visual@skedulei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    pro = await registerUser(http, 'Pro', 'pro-visual@skedulei.test');
    await http.post('/v1/invites/accept').set(pro.auth).send({ token }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('negócio novo não tem imagens: página pública devolve null e as rotas dão 404', async () => {
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page.branding).toEqual({ logoUrl: null, coverUrl: null, brandColor: null, tagline: null });
    await http.get(`/v1/public/orgs/${slug}/brand/logo`).expect(404);
    await http.get(`/v1/public/orgs/nao-existe/brand/logo`).expect(404);
    await http.get(`/v1/public/orgs/${slug}/brand/outro`).expect(400);
  });

  it('só quem administra o negócio troca as imagens', async () => {
    await http.put('/v1/org/branding/logo').set(inOrg(pro)).send({ dataUrl: png }).expect(403);
    await http.delete('/v1/org/branding/logo').set(inOrg(pro)).expect(403);
    await http.put('/v1/org/branding/logo').send({ dataUrl: png }).expect(401);
  });

  it('envia a logo e o fundo e a página pública serve os bytes', async () => {
    const res = await http.put('/v1/org/branding/logo').set(inOrg(dona)).send({ dataUrl: png }).expect(200);
    expect(res.body.branding.logoUrl).toMatch(new RegExp(`^/public/orgs/${slug}/brand/logo\\?v=\\d+$`));
    expect(res.body.branding.coverUrl).toBeNull();
    await http.put('/v1/org/branding/cover').set(inOrg(dona)).send({ dataUrl: png }).expect(200);

    const img = await http.get(`/v1/public/orgs/${slug}/brand/logo`).expect(200);
    expect(img.headers['content-type']).toMatch(/^image\/png/);
    expect(img.headers['x-content-type-options']).toBe('nosniff');
    expect(img.headers['cache-control']).toMatch(/immutable/);
    expect(Buffer.from(img.body).toString('base64')).toBe(PNG);

    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page.branding.logoUrl).toBe(res.body.branding.logoUrl);
    expect(page.branding.coverUrl).toMatch(/brand\/cover\?v=\d+$/);
  });

  it('trocar a imagem muda a versão do endereço (renova o cache)', async () => {
    const before = (await http.get('/v1/org').set(inOrg(dona)).expect(200)).body.branding.logoUrl;
    await new Promise((r) => setTimeout(r, 15));
    const after = (await http.put('/v1/org/branding/logo').set(inOrg(dona)).send({ dataUrl: png }).expect(200)).body.branding.logoUrl;
    expect(after).not.toBe(before);
  });

  it('recusa SVG, HTML, tipo mentido, texto solto e arquivo grande', async () => {
    const svg = `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
    const html = `data:image/jpeg;base64,${Buffer.from('<html><script>alert(1)</script></html>').toString('base64')}`;
    for (const dataUrl of [svg, html, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'javascript:alert(1)', 'http://evil.test/x.png', '']) {
      const r = await http.put('/v1/org/branding/logo').set(inOrg(dona)).send({ dataUrl }).expect(400);
      expect(r.body.message).toMatch(/PNG, JPG ou WebP|dataUrl|must be/i);
    }
    const big = `data:image/png;base64,${Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(320_000, 1)]).toString('base64')}`;
    const r = await http.put('/v1/org/branding/logo').set(inOrg(dona)).send({ dataUrl: big }).expect(400);
    expect(r.body.message).toMatch(/grande demais/);
    // A imagem boa continua lá.
    await http.get(`/v1/public/orgs/${slug}/brand/logo`).expect(200);
  });

  it('cor da paleta, tom livre e frase de boas-vindas; valores inválidos são recusados', async () => {
    const ok = await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: 'rosa', tagline: '  Cuidamos de você 💜  ' }).expect(200);
    expect(ok.body.branding).toMatchObject({ brandColor: 'rosa', tagline: 'Cuidamos de você 💜' });
    const hex = await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: '#FF4400' }).expect(200);
    expect(hex.body.branding.brandColor).toBe('#ff4400');
    const snapped = await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: '#d6409f' }).expect(200);
    expect(snapped.body.branding.brandColor).toBe('rosa');
    await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: '#fff' }).expect(400);
    await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: 'constructor' }).expect(400);
    await http.patch('/v1/org').set(inOrg(dona)).send({ tagline: 'x'.repeat(161) }).expect(400);
    await http.patch('/v1/org').set(inOrg(pro)).send({ brandColor: 'azul' }).expect(403);
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page.branding).toMatchObject({ brandColor: 'rosa', tagline: 'Cuidamos de você 💜' });
    // Limpar volta ao padrão.
    const cleared = await http.patch('/v1/org').set(inOrg(dona)).send({ brandColor: null, tagline: '' }).expect(200);
    expect(cleared.body.branding).toMatchObject({ brandColor: null, tagline: null });
  });

  it('remover apaga a imagem; outro negócio não mexe nas imagens deste', async () => {
    const outra = await registerUser(http, 'Outra Visual', 'outra-visual@skedulei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Visual')).expect(201)).body;
    await http.put('/v1/org/branding/cover').set({ ...outra.auth, [ORG_HEADER]: other.id }).send({ dataUrl: png }).expect(200);
    await http.put('/v1/org/branding/cover').set({ ...outra.auth, [ORG_HEADER]: orgId }).send({ dataUrl: png }).expect(403);
    await http.delete('/v1/org/branding/cover').set({ ...outra.auth, [ORG_HEADER]: other.id }).expect(200);
    // O fundo deste negócio segue intacto.
    await http.get(`/v1/public/orgs/${slug}/brand/cover`).expect(200);

    const gone = await http.delete('/v1/org/branding/logo').set(inOrg(dona)).expect(200);
    expect(gone.body.branding.logoUrl).toBeNull();
    await http.get(`/v1/public/orgs/${slug}/brand/logo`).expect(404);
  });
});
