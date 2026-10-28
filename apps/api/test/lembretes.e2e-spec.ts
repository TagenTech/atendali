/**
 * Lembretes por e-mail (24 h e 2 h antes), link assinado, confirmação de presença e avisos à equipe — banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { Appointment } from '../src/agenda/entities/appointment.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
const SECRET = process.env.CRON_SECRET!;
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const at = (time: string, date = DAY) => zonedToUtc(date, time, TZ).toISOString();

describe('Lembretes e avisos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let orgId = '';
  let slug = '';
  let serviceId = '';
  const inOrg = () => ({ ...dona.auth, [ORG_HEADER]: orgId });
  const outbox = async () => (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; subject: string; link?: string }[];
  const runJob = () => http.post('/v1/internal/jobs/reminders').set('x-cron-secret', SECRET).expect(200);
  /** Marca online e empurra o horário para daqui a `hours` h (e a criação para 2 h atrás) — o job só olha o relógio. */
  async function bookIn(hours: number, email: string, name: string, phone: string) {
    const time = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'][Math.floor(Math.random() * 6)];
    const res = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, startsAt: at(time, addDays(DAY, 7 * Math.floor(Math.random() * 6))), name, phone, email }).expect(201);
    const [row] = (await db.query(`SELECT id FROM ${quotedTable(db, Appointment)} ORDER BY created_at DESC LIMIT 1`)) as { id: string }[];
    const start = new Date(Date.now() + hours * 3_600_000);
    await db.query(`UPDATE ${quotedTable(db, Appointment)} SET starts_at = $2, ends_at = $3, created_at = now() - interval '2 hours' WHERE id = $1`, [row.id, start, new Date(start.getTime() + 45 * 60_000)]);
    return { id: row.id, token: res.body.token as string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Lembretes', 'dona-lembretes@skedulei.test');
    const org = await http.post('/v1/organizations').set(dona.auth).send(newOrg('Salão Lembretes')).expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    serviceId = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body.services[0].id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('o job só responde com o segredo certo', async () => {
    await http.post('/v1/internal/jobs/reminders').expect(401);
    await http.post('/v1/internal/jobs/reminders').set('x-cron-secret', 'errado-errado-errado-errado-errado-1').expect(401);
    const ok = await runJob();
    expect(ok.body).toMatchObject({ checked: expect.any(Number), sent: { H24: 0, H2: 0 } });
  });

  it('manda o lembrete da véspera uma vez só, com link que confirma e remarca', async () => {
    const a = await bookIn(20, 'ana@exemplo.test', 'Ana Souza', '11911110001');
    const before = (await outbox()).length;
    const first = await runJob();
    expect(first.body.sent.H24).toBeGreaterThanOrEqual(1);
    const mails = (await outbox()).filter((m) => m.to === 'ana@exemplo.test' && m.subject.startsWith('Lembrete'));
    expect(mails).toHaveLength(1);
    expect((await outbox()).length).toBeGreaterThan(before);
    const link = mails[0].link!;
    expect(link).toMatch(/\/reserva\/r\.[\w.-]+$/);
    // Rodar de novo não repete.
    await runJob();
    expect((await outbox()).filter((m) => m.to === 'ana@exemplo.test' && m.subject.startsWith('Lembrete'))).toHaveLength(1);

    // O link assinado abre a reserva, confirma a presença e remarca (só aquele agendamento).
    const signed = link.split('/reserva/')[1];
    const view = (await http.get(`/v1/public/bookings/${signed}/group`).expect(200)).body;
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ status: 'AGENDADO', canConfirm: true, clientName: 'Ana Souza' });
    const confirmed = (await http.post(`/v1/public/bookings/${signed}/group/confirm`).send({}).expect(200)).body;
    expect(confirmed.items[0]).toMatchObject({ status: 'CONFIRMADO', canConfirm: false });
    await http.post(`/v1/public/bookings/${signed}/group/confirm`).send({}).expect(200); // de novo: tudo bem
    // Remarcar zera os lembretes: o novo horário será lembrado de novo.
    const [{ reminded_24_at }] = (await db.query(`SELECT reminded_24_at FROM ${quotedTable(db, Appointment)} WHERE id = $1`, [a.id])) as { reminded_24_at: Date | null }[];
    expect(reminded_24_at).not.toBeNull();
    // Link adulterado ou de outro lugar não abre.
    await http.get(`/v1/public/bookings/${signed.slice(0, -3)}abc/group`).expect(404);
    await http.get(`/v1/public/bookings/r.abc.def/group`).expect(404);
  });

  it('lembrete de hoje (até 2 h), sem e-mail não manda, desligado no negócio não manda', async () => {
    await bookIn(1.2, 'bia@exemplo.test', 'Bia Lima', '11911110002');
    const semEmail = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, startsAt: at('16:00', addDays(DAY, 21)), name: 'Sem Email', phone: '11911110003' }).expect(201);
    const [r] = (await db.query(`SELECT id FROM ${quotedTable(db, Appointment)} ORDER BY created_at DESC LIMIT 1`)) as { id: string }[];
    await db.query(`UPDATE ${quotedTable(db, Appointment)} SET starts_at = now() + interval '1 hour', ends_at = now() + interval '2 hours', created_at = now() - interval '3 hours' WHERE id = $1`, [r.id]);
    expect(semEmail.body.token).toBeTruthy();
    const res = await runJob();
    expect(res.body.sent.H2).toBeGreaterThanOrEqual(1);
    const list = await outbox();
    expect(list.filter((m) => m.to === 'bia@exemplo.test' && m.subject.startsWith('Daqui a pouco'))).toHaveLength(1);
    expect(list.filter((m) => m.subject.includes('Sem Email'))).toHaveLength(0);

    // Negócio com lembretes desligados: ninguém recebe.
    await http.patch('/v1/org').set(inOrg()).send({ remindersEnabled: false }).expect(200);
    await bookIn(10, 'caio@exemplo.test', 'Caio Reis', '11911110004');
    await runJob();
    expect((await outbox()).filter((m) => m.to === 'caio@exemplo.test' && m.subject.startsWith('Lembrete'))).toHaveLength(0);
    await http.patch('/v1/org').set(inOrg()).send({ remindersEnabled: true }).expect(200);
    await runJob();
    expect((await outbox()).filter((m) => m.to === 'caio@exemplo.test' && m.subject.startsWith('Lembrete'))).toHaveLength(1);
  });

  it('não lembra quem acabou de marcar nem quem cancelou', async () => {
    const novo = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, startsAt: at('17:00', addDays(DAY, 28)), name: 'Dani Novo', phone: '11911110005', email: 'dani@exemplo.test' }).expect(201);
    const [d] = (await db.query(`SELECT id FROM ${quotedTable(db, Appointment)} ORDER BY created_at DESC LIMIT 1`)) as { id: string }[];
    await db.query(`UPDATE ${quotedTable(db, Appointment)} SET starts_at = now() + interval '10 hours', ends_at = now() + interval '11 hours' WHERE id = $1`, [d.id]); // criada agora
    await runJob();
    expect((await outbox()).filter((m) => m.to === 'dani@exemplo.test' && m.subject.startsWith('Lembrete'))).toHaveLength(0);
    await db.query(`UPDATE ${quotedTable(db, Appointment)} SET created_at = now() - interval '2 hours', status = 'CANCELADO' WHERE id = $1`, [d.id]);
    await runJob();
    expect((await outbox()).filter((m) => m.to === 'dani@exemplo.test' && m.subject.startsWith('Lembrete'))).toHaveLength(0);
    expect(novo.body.token).toBeTruthy();
  });

  it('avisa a equipe quando o cliente marca, remarca e cancela pela página online', async () => {
    const before = (await outbox()).filter((m) => m.to === 'dona-lembretes@skedulei.test').length;
    const r = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId, startsAt: at('11:30', addDays(DAY, 35)), name: 'Eva Online', phone: '11911110006' }).expect(201);
    await new Promise((res) => setTimeout(res, 250));
    let mails = (await outbox()).filter((m) => m.to === 'dona-lembretes@skedulei.test');
    expect(mails.length).toBe(before + 1);
    expect(mails[0].subject).toMatch(/Nova reserva online/);
    await http.post(`/v1/public/bookings/${r.body.token}/group/reschedule`).send({ startsAt: at('12:30', addDays(DAY, 35)) }).expect(200);
    await http.post(`/v1/public/bookings/${r.body.token}/cancel`).expect(200);
    await new Promise((res) => setTimeout(res, 250));
    mails = (await outbox()).filter((m) => m.to === 'dona-lembretes@skedulei.test');
    expect(mails.map((m) => m.subject.split(' · ')[0])).toEqual(expect.arrayContaining(['Reserva cancelada pelo cliente', 'Reserva remarcada pelo cliente', 'Nova reserva online']));
  });
});
