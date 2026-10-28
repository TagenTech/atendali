/**
 * Multiempresa, perfis de acesso e onboarding contra um Postgres real (banco agendei_test).
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { defaultBusinessHours, ORG_HEADER } from '@agendei/contracts';
import { ServiceItem } from '../src/organizations/entities/service-item.entity';
import { TenantDb } from '../src/tenancy/tenant-db';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;

describe('Negócios, equipe e permissões (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let orgId = '';
  let otherOrgId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });

  /** Link do último convite enviado para `to` (caixa de saída de dev; a mais nova vem primeiro). */
  const lastInviteTo = async (to: string) => {
    const outbox = await http.get('/v1/dev/outbox').expect(200);
    return (outbox.body as { to: string; link?: string }[]).find((m) => m.to === to && m.link?.includes('/convite?'))!.link!;
  };

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Bela Dona', 'bela@agendei.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('conta nova não tem negócio (o web manda para o onboarding)', async () => {
    expect((await http.get('/v1/organizations').set(dona.auth).expect(200)).body).toEqual([]);
  });

  it('onboarding valida horário, segmento e serviços', async () => {
    const bad = defaultBusinessHours();
    bad[1] = [{ start: '18:00', end: '09:00' }];
    const res = await http.post('/v1/organizations').set(dona.auth).send(newOrg('X', { unit: { name: 'P', businessHours: bad } })).expect(400);
    expect(JSON.stringify(res.body)).toContain('Segunda: o fim precisa ser depois do início');
    await http.post('/v1/organizations').set(dona.auth).send(newOrg('X', { segment: 'PADARIA' })).expect(400);
    await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(newOrg('X', { services: [{ name: 'Corte', category: 'Cabelo', durationMinutes: 1, priceCents: -5 }] }))
      .expect(400);
  });

  it('onboarding cria negócio, unidade, dona, serviços e convites de uma vez', async () => {
    const res = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Studio Bella & Cia', {
          team: [
            { name: 'Rita Recepção', email: 'rita@agendei.test', role: 'RECEPCAO', bookable: false },
            { name: 'Paula Profissional', email: 'paula@agendei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Mari Manicure', role: 'PROFISSIONAL', bookable: true },
          ],
        }),
      )
      .expect(201);
    orgId = res.body.id;
    expect(res.body).toMatchObject({
      slug: 'studio-bella-e-cia',
      segment: 'SALAO_BELEZA',
      features: ['COMISSOES', 'ESTOQUE', 'PACOTES'],
      vocabulary: { client: 'Cliente' },
      me: { role: 'DONO' },
    });
    expect(res.body.me.permissions).toContain('org.delete');

    const units = (await http.get('/v1/org/units').set(inOrg(dona)).expect(200)).body;
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ name: 'Principal', state: 'SP', timezone: 'America/Sao_Paulo' });

    const members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { name: string; status: string; isMe: boolean }[];
    expect(members.map((m) => [m.name, m.status])).toEqual([
      ['Bela Dona', 'ATIVO'],
      ['Mari Manicure', 'SEM_ACESSO'],
      ['Paula Profissional', 'CONVIDADO'],
      ['Rita Recepção', 'CONVIDADO'],
    ]);
    expect(members.find((m) => m.isMe)!.name).toBe('Bela Dona');

    const services = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body;
    expect(services).toEqual([expect.objectContaining({ name: 'Corte', priceCents: 8000, active: true })]);
  });

  it('mesmo nome gera outro endereço público', async () => {
    const outra = await registerUser(http, 'Outra Bella', 'outra-bella@agendei.test');
    const res = await http.post('/v1/organizations').set(outra.auth).send(newOrg('Studio Bella & Cia')).expect(201);
    expect(res.body.slug).toBe('studio-bella-e-cia-2');
  });

  it('rotas do negócio exigem o header e cadastro ativo na equipe', async () => {
    await http.get('/v1/org').set(dona.auth).expect(403);
    await http.get('/v1/org').set(inOrg(dona, 'nao-e-uuid')).expect(403);
    await http.get('/v1/org').set(inOrg(dona, '00000000-0000-4000-8000-000000000000')).expect(403);
    const intrusa = await registerUser(http, 'Intrusa', 'intrusa@agendei.test');
    await http.get('/v1/org/services').set(inOrg(intrusa)).expect(403);
    await http.post('/v1/org/services').set(inOrg(intrusa)).send({ name: 'X', durationMinutes: 30, priceCents: 0 }).expect(403);
  });

  let rita: Session;
  it('convite: só a conta do e-mail convidado aceita, uma vez', async () => {
    const link = await lastInviteTo('rita@agendei.test');
    const token = link.split('token=')[1];
    const info = (await http.get(`/v1/invites/info?token=${token}`).expect(200)).body;
    expect(info).toMatchObject({ organizationName: 'Studio Bella & Cia', role: 'RECEPCAO' });
    expect(info.email).not.toBe('rita@agendei.test');

    const errada = await registerUser(http, 'Errada', 'errada@agendei.test');
    await http.post('/v1/invites/accept').set(errada.auth).send({ token }).expect(403);

    rita = await registerUser(http, 'Rita R', 'rita@agendei.test');
    const ok = await http.post('/v1/invites/accept').set(rita.auth).send({ token }).expect(201);
    expect(ok.body).toMatchObject({ id: orgId, role: 'RECEPCAO' });
    await http.post('/v1/invites/accept').set(rita.auth).send({ token }).expect(400);
    // Aceitar pelo link do e-mail confirma o e-mail da conta.
    expect((await http.get('/v1/me').set(rita.auth).expect(200)).body.emailVerified).toBe(true);
    expect((await http.get('/v1/organizations').set(rita.auth).expect(200)).body).toHaveLength(1);
  });

  it('recepção vê equipe e serviços, mas não mexe neles nem no negócio', async () => {
    const org = (await http.get('/v1/org').set(inOrg(rita)).expect(200)).body;
    expect(org.me.role).toBe('RECEPCAO');
    expect(org.me.permissions).not.toContain('finance.view');
    await http.get('/v1/org/members').set(inOrg(rita)).expect(200);
    await http.get('/v1/org/services').set(inOrg(rita)).expect(200);
    await http.post('/v1/org/services').set(inOrg(rita)).send({ name: 'X', durationMinutes: 30, priceCents: 0 }).expect(403);
    await http.post('/v1/org/members').set(inOrg(rita)).send({ name: 'Y', role: 'PROFISSIONAL', bookable: true }).expect(403);
    await http.patch('/v1/org').set(inOrg(rita)).send({ name: 'Hackeado' }).expect(403);
  });

  it('equipe: sem e-mail só como profissional; e-mail repetido é recusado', async () => {
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name: 'Sem Email', role: 'GERENTE', bookable: false }).expect(400);
    await http
      .post('/v1/org/members')
      .set(inOrg(dona))
      .send({ name: 'Repetida', email: 'PAULA@agendei.test', role: 'PROFISSIONAL', bookable: true })
      .expect(409);
  });

  it('gerente não promove ninguém a gerente/dono; dono pode', async () => {
    const gRes = await http
      .post('/v1/org/members')
      .set(inOrg(dona))
      .send({ name: 'Gil Gerente', email: 'gil@agendei.test', role: 'GERENTE', bookable: false })
      .expect(201);
    const gil = await registerUser(http, 'Gil', 'gil@agendei.test');
    // O link vem antes: o supertest não aceita uma requisição aberta enquanto outra roda.
    const gilToken = (await lastInviteTo('gil@agendei.test')).split('token=')[1];
    await http.post('/v1/invites/accept').set(gil.auth).send({ token: gilToken }).expect(201);

    const members = (await http.get('/v1/org/members').set(inOrg(gil)).expect(200)).body as { id: string; name: string }[];
    const mari = members.find((m) => m.name === 'Mari Manicure')!;
    const ritaM = members.find((m) => m.name === 'Rita Recepção')!;
    await http.patch(`/v1/org/members/${mari.id}`).set(inOrg(gil)).send({ role: 'GERENTE' }).expect(403);
    await http.patch(`/v1/org/members/${ritaM.id}`).set(inOrg(gil)).send({ role: 'FINANCEIRO' }).expect(200);
    await http.delete(`/v1/org/members/${gRes.body.id}`).set(inOrg(rita)).expect(403);
    // Gerente cria serviço; dono desativa.
    const svc = await http.post('/v1/org/services').set(inOrg(gil)).send({ name: 'Hidratação', durationMinutes: 40, priceCents: 7000 }).expect(201);
    const off = await http.patch(`/v1/org/services/${svc.body.id}`).set(inOrg(dona)).send({ active: false }).expect(200);
    expect(off.body.active).toBe(false);
  });

  it('dar e-mail a quem não tinha acesso vira convite', async () => {
    const members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { id: string; name: string }[];
    const mari = members.find((m) => m.name === 'Mari Manicure')!;
    const res = await http.patch(`/v1/org/members/${mari.id}`).set(inOrg(dona)).send({ email: 'mari@agendei.test' }).expect(200);
    expect(res.body.status).toBe('CONVIDADO');
    expect(await lastInviteTo('mari@agendei.test')).toContain('/convite?token=');
  });

  it('o último dono não sai nem perde o perfil', async () => {
    const me = (await http.get('/v1/org').set(inOrg(dona)).expect(200)).body.me;
    await http.patch(`/v1/org/members/${me.memberId}`).set(inOrg(dona)).send({ role: 'GERENTE' }).expect(400);
    await http.delete('/v1/org/membership').set(inOrg(dona)).expect(400);
  });

  it('isola dados entre negócios', async () => {
    const outra = await registerUser(http, 'Vizinha', 'vizinha@agendei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Barbearia Vizinha', { segment: 'BARBEARIA' })).expect(201)).body;
    otherOrgId = other.id;
    const theirServices = (await http.get('/v1/org/services').set(inOrg(outra, other.id)).expect(200)).body as { id: string }[];
    // A dona do Studio não enxerga nem altera nada da vizinha, nem trocando o header.
    await http.get('/v1/org/services').set(inOrg(dona, other.id)).expect(403);
    await http.patch(`/v1/org/services/${theirServices[0].id}`).set(inOrg(dona)).send({ priceCents: 1 }).expect(404);
    const mine = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body as { id: string }[];
    expect(mine.map((s) => s.id)).not.toContain(theirServices[0].id);
  });

  it('editar o negócio: módulos desconhecidos são recusados', async () => {
    await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['PRONTUARIO', 'TELETRANSPORTE'] }).expect(400);
    const res = await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['PRONTUARIO', 'COMISSOES'], document: '12.345.678/0001-90' }).expect(200);
    expect(res.body).toMatchObject({ features: ['COMISSOES', 'PRONTUARIO'], document: '12345678000190' });
  });

  it('excluir a conta: recusa se é a única dona com equipe ativa', async () => {
    await http.post('/v1/auth/delete-account').set(dona.auth).send({ confirmEmail: dona.email, password: dona.password }).expect(400);
  });

  it('RLS no Postgres: dentro do negócio, consulta sem filtro só enxerga o próprio negócio', async () => {
    const tenant = app.get(TenantDb);
    const seen = await tenant.runAsTenant(orgId, () => tenant.repo(ServiceItem).find());
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((s) => s.organizationId))).toEqual(new Set([orgId]));
    // Gravar para outro negócio é barrado pela política (WITH CHECK).
    await expect(
      tenant.runAsTenant(orgId, () =>
        tenant.repo(ServiceItem).insert({ organizationId: otherOrgId, name: 'Invasão', durationMinutes: 30, priceCents: 0 }),
      ),
    ).rejects.toThrow(/row-level security/);
    // Fora de rota de negócio (sistema), enxerga todos.
    const all = await tenant.repo(ServiceItem).find();
    expect(new Set(all.map((s) => s.organizationId)).size).toBeGreaterThan(1);
  });
});
