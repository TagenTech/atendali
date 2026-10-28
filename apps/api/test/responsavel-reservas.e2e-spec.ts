/**
 * Responsável × paciente e "Minhas reservas" (código no e-mail → ver, cancelar, remarcar) — banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { Appointment } from '../src/agenda/entities/appointment.entity';
import { Client } from '../src/agenda/entities/client.entity';
import { PortalCode } from '../src/agenda/entities/portal-code.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const at = (time: string, date = DAY) => zonedToUtc(date, time, TZ).toISOString();
const MAE = '11988887777';

describe('Responsável × paciente e Minhas reservas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let outra: Session;
  let orgId = '';
  let slug = '';
  let otherSlug = '';
  let serviceId = '';
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });
  const book = (body: Record<string, unknown>) => http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, phone: MAE, ...body });
  const lastCode = async (email: string) => {
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; code?: string }[];
    return box.find((m) => m.to === email && m.code)?.code;
  };
  const codeFor = async (phone: string, orgSlug = slug) => {
    await http.post(`/v1/public/orgs/${orgSlug}/my-bookings/code`).send({ phone }).expect(200);
    await new Promise((r) => setTimeout(r, 150));
  };

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Pediatria', 'dona-pediatria@skedulei.test');
    const org = await http.post('/v1/organizations').set(dona.auth).send(newOrg('Clínica Pequenos Passos', { segment: 'CLINICA_MEDICA' })).expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    serviceId = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body.services[0].id;
    outra = await registerUser(http, 'Outra Dona', 'outra-dona@skedulei.test');
    const other = await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Salão')).expect(201);
    otherSlug = other.body.slug;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('a mãe marca para dois filhos com o mesmo telefone: cada um é um paciente, com ela como responsável', async () => {
    const sofia = await book({ name: 'Mariana Costa', email: 'mariana@exemplo.test', patientName: 'Sofia Costa', patientBirthDate: '2021-03-10', relationship: 'MAE', startsAt: at('10:00') }).expect(201);
    expect(sofia.body.clientName).toBe('Sofia Costa');
    const davi = await book({ name: 'Mariana Costa', patientName: 'Davi Costa', relationship: 'MAE', startsAt: at('11:00') }).expect(201);
    expect(davi.body.clientName).toBe('Davi Costa');

    const list = (await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body as { id: string; name: string; phone: string; guardianName: string; guardianRelationship: string; birthDate: string | null }[];
    expect(list.map((c) => c.name).sort()).toEqual(['Davi Costa', 'Sofia Costa']);
    expect(list.every((c) => c.phone === MAE && c.guardianName === 'Mariana Costa' && c.guardianRelationship === 'MAE')).toBe(true);
    expect(list.find((c) => c.name === 'Sofia Costa')!.birthDate).toBe('2021-03-10');

    // O mesmo paciente marcando de novo (mesmo nome, outra grafia) não duplica.
    await book({ name: 'Mariana Costa', patientName: 'SOFIA  costa', relationship: 'MAE', startsAt: at('14:00') }).expect(201);
    expect((await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body).toHaveLength(2);

    // A ficha mostra os outros pacientes do mesmo telefone.
    const sofiaId = list.find((c) => c.name === 'Sofia Costa')!.id;
    const ficha = (await http.get(`/v1/org/clients/${sofiaId}`).set(inOrg(dona)).expect(200)).body;
    expect(ficha.relatives.map((r: { name: string }) => r.name)).toEqual(['Davi Costa']);
    // Buscar pelo nome da mãe acha os filhos.
    expect((await http.get('/v1/org/clients?q=Mariana').set(inOrg(dona)).expect(200)).body).toHaveLength(2);
  });

  it('quem marca para si mesmo continua sendo o paciente (sem responsável)', async () => {
    const r = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, name: 'Paula Adulta', phone: '11977776666', startsAt: at('15:00') }).expect(201);
    expect(r.body.clientName).toBe('Paula Adulta');
    const paula = (await http.get('/v1/org/clients?q=Paula').set(inOrg(dona)).expect(200)).body[0];
    expect(paula.guardianName).toBeNull();
    // Voltou digitando só o primeiro nome: reconhece a mesma pessoa.
    await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, name: 'Paula', phone: '11977776666', startsAt: at('16:00') }).expect(201);
    expect((await http.get('/v1/org/clients?q=Paula').set(inOrg(dona)).expect(200)).body).toHaveLength(1);
  });

  it('parentesco inválido é recusado', async () => {
    await book({ name: 'Mariana Costa', patientName: 'Outro Filho', relationship: 'VIZINHO', startsAt: at('17:00') }).expect(400);
  });

  it('o teto de reservas vale para a família toda (mesmo telefone)', async () => {
    // Já há 3 reservas ativas da família da Mariana (Sofia 10:00, Davi 11:00, Sofia 14:00); faltam 2 até o teto de 5.
    await book({ name: 'Mariana Costa', patientName: 'Davi Costa', startsAt: at('12:00') }).expect(201);
    await book({ name: 'Mariana Costa', patientName: 'Davi Costa', startsAt: at('13:00') }).expect(201);
    const blocked = await book({ name: 'Mariana Costa', patientName: 'Sofia Costa', startsAt: at('17:00') }).expect(409);
    expect(blocked.body.message).toMatch(/5 horários marcados/);
  });

  describe('Minhas reservas', () => {
    let session = '';

    it('sem e-mail cadastrado a resposta é a mesma e nada é enviado', async () => {
      const before = (await http.get('/v1/dev/outbox').expect(200)).body.length;
      await http.post(`/v1/public/orgs/${slug}/my-bookings/code`).send({ phone: '11900000000' }).expect(200).expect({ sent: true });
      await http.post(`/v1/public/orgs/${slug}/my-bookings/verify`).send({ phone: '11900000000', code: '123456' }).expect(401);
      await new Promise((r) => setTimeout(r, 100));
      expect((await http.get('/v1/dev/outbox').expect(200)).body.length).toBe(before);
    });

    it('código errado é recusado e, depois de 5 erros, o código certo também', async () => {
      await codeFor(MAE);
      const code = (await lastCode('mariana@exemplo.test'))!;
      expect(code).toMatch(/^\d{6}$/);
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) await http.post(`/v1/public/orgs/${slug}/my-bookings/verify`).send({ phone: MAE, code: wrong }).expect(401);
      await http.post(`/v1/public/orgs/${slug}/my-bookings/verify`).send({ phone: MAE, code }).expect(401);
    });

    it('o código certo abre a sessão e lista as reservas da família (e só dela)', async () => {
      await db.query(`DELETE FROM ${quotedTable(db, PortalCode)}`);
      await codeFor(MAE);
      const code = (await lastCode('mariana@exemplo.test'))!;
      const res = await http.post(`/v1/public/orgs/${slug}/my-bookings/verify`).send({ phone: MAE, code }).expect(200);
      session = res.body.token;
      expect(res.body.expiresIn).toBe(3600);
      // Código de uso único.
      await http.post(`/v1/public/orgs/${slug}/my-bookings/verify`).send({ phone: MAE, code }).expect(401);

      const mine = (await http.get(`/v1/public/orgs/${slug}/my-bookings`).set('authorization', `Bearer ${session}`).expect(200)).body as { patientName: string; canChange: boolean }[];
      expect(mine.map((b) => b.patientName).sort()).toEqual(['Davi Costa', 'Davi Costa', 'Davi Costa', 'Sofia Costa', 'Sofia Costa']);
      expect(mine.every((b) => b.canChange)).toBe(true);
      // Sem sessão, com lixo ou na página de outro negócio: nada.
      await http.get(`/v1/public/orgs/${slug}/my-bookings`).expect(401);
      await http.get(`/v1/public/orgs/${slug}/my-bookings`).set('authorization', 'Bearer abc.def').expect(401);
      await http.get(`/v1/public/orgs/${otherSlug}/my-bookings`).set('authorization', `Bearer ${session}`).expect(401);
      const forged = session.split('.')[0] + '.' + 'x'.repeat(43);
      await http.get(`/v1/public/orgs/${slug}/my-bookings`).set('authorization', `Bearer ${forged}`).expect(401);
    });

    it('remarca para um horário livre e recusa horário ocupado, fora da grade ou de outra pessoa', async () => {
      const auth = { authorization: `Bearer ${session}` };
      const mine = (await http.get(`/v1/public/orgs/${slug}/my-bookings`).set(auth).expect(200)).body as { id: string; patientName: string; startsAt: string }[];
      const first = mine.find((b) => b.patientName === 'Sofia Costa' && b.startsAt === at('10:00'))!;
      await http.post(`/v1/public/orgs/${slug}/my-bookings/${first.id}/reschedule`).set(auth).send({ startsAt: at('11:00') }).expect(409); // ocupado pelo Davi (único profissional)
      await http.post(`/v1/public/orgs/${slug}/my-bookings/${first.id}/reschedule`).set(auth).send({ startsAt: at('03:00') }).expect(409);
      await http.post(`/v1/public/orgs/${slug}/my-bookings/${first.id}/reschedule`).set(auth).send({ startsAt: at('10:15') }).expect(200); // encosta no próprio horário
      const after = (await http.get(`/v1/public/orgs/${slug}/my-bookings`).set(auth).expect(200)).body as { id: string; startsAt: string }[];
      expect(after.find((b) => b.id === first.id)!.startsAt).toBe(at('10:15'));
      // Na agenda da clínica o horário mudou.
      const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
      expect(day.appointments.some((a: { id: string; startsAt: string }) => a.id === first.id && a.startsAt === at('10:15'))).toBe(true);
      // Reserva de outro negócio: 404 (não revela).
      await http.post(`/v1/public/orgs/${otherSlug}/my-bookings/${first.id}/reschedule`).set(auth).send({ startsAt: at('12:00') }).expect(401);
    });

    it('cancela uma reserva da família; a de quem tem outro telefone não é alcançável', async () => {
      const auth = { authorization: `Bearer ${session}` };
      const mine = (await http.get(`/v1/public/orgs/${slug}/my-bookings`).set(auth).expect(200)).body as { id: string }[];
      await http.post(`/v1/public/orgs/${slug}/my-bookings/${mine[0].id}/cancel`).set(auth).expect(200);
      const after = (await http.get(`/v1/public/orgs/${slug}/my-bookings`).set(auth).expect(200)).body as { id: string }[];
      expect(after.some((b) => b.id === mine[0].id)).toBe(false);
      // Reserva da Paula (outro telefone): 404 com a sessão da Mariana.
      const paula = (await db.query(`SELECT a.id FROM ${quotedTable(db, Appointment)} a JOIN ${quotedTable(db, Client)} c ON c.id = a.client_id WHERE c.name = 'Paula Adulta' LIMIT 1`)) as { id: string }[];
      expect(paula).toHaveLength(1);
      await http.post(`/v1/public/orgs/${slug}/my-bookings/${paula[0].id}/cancel`).set(auth).expect(404);
      await http.post(`/v1/public/orgs/${slug}/my-bookings/not-a-uuid/cancel`).set(auth).expect(400);
    });

    it('remarcar pelo link da reserva também funciona', async () => {
      const r = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, name: 'Lia Link', phone: '11966665555', email: 'lia@exemplo.test', startsAt: at('18:00') }).expect(201);
      const moved = await http.post(`/v1/public/bookings/${r.body.token}/reschedule`).send({ startsAt: at('18:15') }).expect(200);
      expect(moved.body.startsAt).toBe(at('18:15'));
      // Depois do expediente (o serviço dura 45 min e a clínica fecha às 19h) não há horário.
      await http.post(`/v1/public/bookings/${r.body.token}/reschedule`).send({ startsAt: at('18:30') }).expect(409);
      await http.post(`/v1/public/bookings/${r.body.token}/reschedule`).send({ startsAt: at('11:00') }).expect(409);
    });
  });
});
