/**
 * Equipe, convites, unidades e dados do negócio: permissões e recusas que o fluxo feliz não visita.
 * Banco skedulei_test.
 */
// O limite de criação de negócios por hora é lido ao carregar o módulo: sobe antes dos imports.
process.env.REGISTER_THROTTLE_LIMIT = '100';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
type Member = { id: string; name: string; status: string; role: string; email: string | null };
const TZ = 'America/Sao_Paulo';
const NOBODY = '00000000-0000-4000-8000-000000000000';
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}

describe('Equipe, convites e negócio: recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let gil: Session;
  let orgId = '';
  let corteId = '';
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });
  const members = async () => (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as Member[];
  const byName = async (name: string) => (await members()).find((m) => m.name === name)!;
  const inviteTo = async (email: string) => {
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    return box.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
  };

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Equipe', 'dona-equipe@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Studio Equipe', {
          team: [
            { name: 'Gil Gerente', email: 'gil-equipe@skedulei.test', role: 'GERENTE', bookable: false },
            { name: 'Paula Pro', email: 'paula-equipe@skedulei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Mari Sem Acesso', role: 'PROFISSIONAL', bookable: true },
            { name: 'Dona Equipe', email: 'dona-equipe@skedulei.test', role: 'DONO', bookable: true },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    corteId = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0].id;
    gil = await registerUser(http, 'Gil', 'gil-equipe@skedulei.test');
    const gilToken = await inviteTo('gil-equipe@skedulei.test');
    await http.post('/v1/invites/accept').set(gil.auth).send({ token: gilToken }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gerente não dá nem altera acesso de dono e de gerente', async () => {
    const base = { name: 'Fulano', bookable: false };
    await http.post('/v1/org/members').set(inOrg(gil)).send({ ...base, email: 'fulano-dono@skedulei.test', role: 'DONO' }).expect(403);
    await http.post('/v1/org/members').set(inOrg(gil)).send({ ...base, email: 'fulano-ger@skedulei.test', role: 'GERENTE' }).expect(403);
    const donoM = (await members()).find((m) => m.role === 'DONO')!;
    await http.patch(`/v1/org/members/${donoM.id}`).set(inOrg(gil)).send({ name: 'Nova Dona' }).expect(403);
    await http.delete(`/v1/org/members/${donoM.id}`).set(inOrg(gil)).expect(403);
    const paula = await byName('Paula Pro');
    await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(gil)).send({ role: 'DONO' }).expect(403);
    await http.patch(`/v1/org/members/${NOBODY}`).set(inOrg(gil)).send({ name: 'Ninguém' }).expect(404);
    await http.post(`/v1/org/members/${NOBODY}/resend-invite`).set(inOrg(dona)).expect(404);
  });

  it('e-mail da equipe: quem já entrou não troca; convite pendente troca, repete ou vira sem acesso', async () => {
    const paula = await byName('Paula Pro');
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name: 'Outra', email: 'GIL-EQUIPE@skedulei.test', role: 'RECEPCAO', bookable: false }).expect(409);
    // Paula ainda não aceitou: o convite pode ser corrigido.
    await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(dona)).send({ email: 'gil-equipe@skedulei.test' }).expect(409);
    const novo = await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(dona)).send({ email: 'paula-nova@skedulei.test', phone: '11988887777', color: 3, bookable: true, commissionBps: 3000, workingHours: null }).expect(200);
    expect(novo.body).toMatchObject({ status: 'CONVIDADO', email: 'paula-nova@skedulei.test', commissionBps: 3000 });
    expect(await inviteTo('paula-nova@skedulei.test')).toBeTruthy();
    const mesmo = await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(dona)).send({ email: 'paula-nova@skedulei.test', phone: null }).expect(200);
    expect(mesmo.body.phone).toBeNull();

    const reenviado = await http.post(`/v1/org/members/${paula.id}/resend-invite`).set(inOrg(dona)).expect(201);
    expect(reenviado.body.status).toBe('CONVIDADO');
    const semConvite = await byName('Mari Sem Acesso');
    const nada = await http.post(`/v1/org/members/${semConvite.id}/resend-invite`).set(inOrg(dona)).expect(400);
    expect(nada.body.message).toMatch(/convite pendente/);

    // Tirar o e-mail volta a "sem acesso"; sem e-mail só profissional.
    const sem = await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(dona)).send({ email: null }).expect(200);
    expect(sem.body).toMatchObject({ status: 'SEM_ACESSO', email: null, bookable: true });
    await http.patch(`/v1/org/members/${paula.id}`).set(inOrg(dona)).send({ role: 'RECEPCAO' }).expect(400);
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name: 'Sem e-mail', role: 'RECEPCAO', bookable: false }).expect(400);
  });

  it('convite: dados públicos, e-mail errado, token ruim e quem já faz parte', async () => {
    const mari = await byName('Mari Sem Acesso');
    await http.patch(`/v1/org/members/${mari.id}`).set(inOrg(dona)).send({ email: 'mari-equipe@skedulei.test' }).expect(200);
    const token = await inviteTo('mari-equipe@skedulei.test');
    const info = await http.get(`/v1/invites/info?token=${token}`).expect(200);
    expect(info.body).toMatchObject({ organizationName: 'Studio Equipe', role: 'PROFISSIONAL' });
    expect(info.body.email).toMatch(/\*/);
    await http.get('/v1/invites/info').expect(400);
    await http.get('/v1/invites/info?token=lixo').expect(400);

    const errada = await registerUser(http, 'Errada', 'errada-equipe@skedulei.test');
    await http.post('/v1/invites/accept').set(errada.auth).send({ token }).expect(403);
    // Vencido: o token existe, mas o prazo passou.
    const db = app.get((await import('typeorm')).DataSource);
    await db.query(`UPDATE "${db.getMetadata('Member').tableName}" SET invite_expires_at = now() - interval '1 day' WHERE id = $1`, [mari.id]);
    await http.post('/v1/invites/accept').set(errada.auth).send({ token }).expect(400);
    const novo = await http.post(`/v1/org/members/${mari.id}/resend-invite`).set(inOrg(dona)).expect(201);
    expect(novo.body.status).toBe('CONVIDADO');
    const mariS = await registerUser(http, 'Mari', 'mari-equipe@skedulei.test');
    const mariToken = await inviteTo('mari-equipe@skedulei.test');
    await http.post('/v1/invites/accept').set(mariS.auth).send({ token: mariToken }).expect(201);
    // Quem já aceitou não troca mais o e-mail por aqui.
    const ativa = await http.patch(`/v1/org/members/${mari.id}`).set(inOrg(dona)).send({ email: 'outro@skedulei.test' }).expect(400);
    expect(ativa.body.message).toMatch(/já tem acesso/);
  });

  it('remover: sem histórico apaga; com agendamento arquiva e o nome fica no histórico', async () => {
    const solto = (await http.post('/v1/org/members').set(inOrg(dona)).send({ name: 'Sem Histórico', role: 'PROFISSIONAL', bookable: true }).expect(201)).body;
    await http.delete(`/v1/org/members/${solto.id}`).set(inOrg(dona)).expect(204);
    expect((await members()).some((m) => m.id === solto.id)).toBe(false);

    const comHistorico = (await http.post('/v1/org/members').set(inOrg(dona)).send({ name: 'Com Histórico', role: 'PROFISSIONAL', bookable: true }).expect(201)).body;
    const ana = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Ana Equipe' }).expect(201)).body.id;
    await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: comHistorico.id, serviceId: corteId, clientId: ana, startsAt: zonedToUtc(nextTuesday(), '10:00', TZ).toISOString() })
      .expect(201);
    await http.delete(`/v1/org/members/${comHistorico.id}`).set(inOrg(dona)).expect(204);
    expect((await members()).some((m) => m.id === comHistorico.id)).toBe(false);
    await http.delete(`/v1/org/members/${NOBODY}`).set(inOrg(dona)).expect(404);

    // Sair da própria equipe (sem ser o último dono).
    await http.delete('/v1/org/membership').set(inOrg(gil)).expect(204);
    await http.get('/v1/org').set(inOrg(gil)).expect(403);
  });

  it('unidades: cria, edita e não mexe em unidade de outro negócio', async () => {
    const nova = await http.post('/v1/org/units').set(inOrg(dona)).send({ name: 'Filial Centro', city: 'Campinas', state: 'sp', businessHours: newOrg('x').unit.businessHours }).expect(201);
    expect(nova.body).toMatchObject({ name: 'Filial Centro', city: 'Campinas' });
    const ed = await http.patch(`/v1/org/units/${nova.body.id}`).set(inOrg(dona)).send({ name: 'Filial Norte' }).expect(200);
    expect(ed.body.name).toBe('Filial Norte');
    await http.patch(`/v1/org/units/${NOBODY}`).set(inOrg(dona)).send({ name: 'Nada' }).expect(404);
    expect((await http.get('/v1/org/units').set(inOrg(dona)).expect(200)).body).toHaveLength(2);
  });

  it('dados do negócio: cada campo é salvo; parcial não apaga o resto', async () => {
    const r = await http
      .patch('/v1/org')
      .set(inOrg(dona))
      .send({ name: 'Studio Equipe 2', phone: '11 98888-7777', document: '11222333000181', brandColor: 'azul', tagline: 'Cuidado de verdade', commissionBase: 'LIQUIDO', remindersEnabled: false })
      .expect(200);
    expect(r.body).toMatchObject({ name: 'Studio Equipe 2', commissionBase: 'LIQUIDO', remindersEnabled: false });
    const so = await http.patch('/v1/org').set(inOrg(dona)).send({ tagline: 'Nova frase' }).expect(200);
    expect(so.body.name).toBe('Studio Equipe 2');
    expect(JSON.stringify(so.body)).toContain('Nova frase');
  });

  it('onboarding: endereço público de nome sem letras, serviço sem categoria e e-mail do dono na equipe', async () => {
    const outra = await registerUser(http, 'Outra Dona', 'outra-dona-equipe@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(outra.auth)
      .send(
        newOrg('!!', {
          services: [{ name: 'Serviço sem categoria', durationMinutes: 30, priceCents: 1000 }],
          team: [{ name: 'Eu mesma', email: 'outra-dona-equipe@skedulei.test', role: 'DONO', bookable: true }],
        }),
      )
      .expect(201);
    expect(org.body.slug).toMatch(/^negocio-agenda/);
    const eq = (await http.get('/v1/org/members').set({ ...outra.auth, [ORG_HEADER]: org.body.id }).expect(200)).body as Member[];
    expect(eq).toHaveLength(1);
  });

  it('limite de negócios por conta', async () => {
    const maluca = await registerUser(http, 'Muitos Negócios', 'muitos@skedulei.test');
    for (let i = 0; i < 10; i++) await http.post('/v1/organizations').set(maluca.auth).send(newOrg(`Negócio ${i}`)).expect(201);
    const r = await http.post('/v1/organizations').set(maluca.auth).send(newOrg('Negócio 11')).expect(400);
    expect(r.body.message).toMatch(/Limite de negócios/);
  });
});
