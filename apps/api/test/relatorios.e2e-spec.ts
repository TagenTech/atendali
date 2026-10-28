/**
 * Relatórios de gestão: visão geral (faltas, ticket, retorno, ocupação), clientes sem voltar e aniversariantes.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { Appointment } from '../src/agenda/entities/appointment.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
const TODAY = todayIn(TZ);
let tue = addDays(TODAY, 7);
while (weekdayOf(tue) !== 2) tue = addDays(tue, 1);

describe('Relatórios (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let rita: Session;
  let fin: Session;
  let outra: Session;
  let orgId = '';
  let otherOrgId = '';
  let memberId = '';
  let serviceId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });

  async function joinTeam(email: string, role: string, name: string) {
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name, email, role, bookable: false }).expect(201);
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }

  /** Cria um atendimento (num horário futuro livre) e o move para `daysAgo` dias atrás, com o status pedido. */
  let slot = 0;
  async function visit(clientId: string, daysAgo: number, status: string) {
    const time = `${String(9 + slot++).padStart(2, '0')}:00`;
    const created = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId, serviceId, clientId, startsAt: zonedToUtc(tue, time, TZ).toISOString() })
      .expect(201);
    const day = addDays(TODAY, -daysAgo);
    const start = zonedToUtc(day, '10:00', TZ);
    await db.query(`UPDATE ${quotedTable(db, Appointment)} SET starts_at = $2, ends_at = $3, status = $4 WHERE id = $1`, [created.body.id, start, new Date(start.getTime() + 45 * 60_000), status]);
  }
  const client = async (name: string, extra: Record<string, unknown> = {}) => (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name, phone: `119${Math.floor(10000000 + Math.random() * 89999999)}`, ...extra }).expect(201)).body.id as string;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Relatórios', 'dona-relatorios@skedulei.test');
    orgId = (await http.post('/v1/organizations').set(dona.auth).send(newOrg('Salão Relatórios')).expect(201)).body.id;
    rita = await joinTeam('rita-rel@skedulei.test', 'RECEPCAO', 'Rita Recepção');
    fin = await joinTeam('fin-rel@skedulei.test', 'FINANCEIRO', 'Fabi Financeiro');
    outra = await registerUser(http, 'Outra Dona', 'outra-rel@skedulei.test');
    otherOrgId = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Salão')).expect(201)).body.id;
    memberId = ((await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { id: string; bookable: boolean }[]).find((m) => m.bookable)!.id;
    serviceId = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0].id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('só quem vê relatórios (dono, gerente, financeiro) abre; recepção e outro negócio não', async () => {
    const q = `from=${addDays(TODAY, -30)}&to=${TODAY}`;
    await http.get(`/v1/org/reports/overview?${q}`).set(inOrg(rita)).expect(403);
    await http.get('/v1/org/reports/inactive').set(inOrg(rita)).expect(403);
    await http.get('/v1/org/reports/birthdays').set(inOrg(rita)).expect(403);
    await http.get(`/v1/org/reports/overview?${q}`).set(inOrg(fin)).expect(200);
    await http.get(`/v1/org/reports/overview?${q}`).set(inOrg(outra)).expect(403); // sem o cabeçalho do negócio dela
  });

  it('valida o período', async () => {
    await http.get(`/v1/org/reports/overview?from=${TODAY}&to=${addDays(TODAY, -1)}`).set(inOrg(dona)).expect(400);
    await http.get(`/v1/org/reports/overview?from=${addDays(TODAY, -400)}&to=${TODAY}`).set(inOrg(dona)).expect(400);
    await http.get('/v1/org/reports/overview?from=ontem&to=hoje').set(inOrg(dona)).expect(400);
    await http.get('/v1/org/reports/inactive?dias=0').set(inOrg(dona)).expect(400);
  });

  it('visão geral: faltas, cancelamentos, ticket, retorno e ocupação', async () => {
    const ana = await client('Ana Antiga');
    const bia = await client('Bia Nova');
    const cadu = await client('Cadu Faltoso');
    const duda = await client('Duda Cancelou');
    await visit(ana, 100, 'CONCLUIDO'); // antes do período: Ana é cliente que volta
    await visit(ana, 10, 'CONCLUIDO');
    await visit(bia, 5, 'CONCLUIDO');
    await visit(cadu, 3, 'FALTOU');
    await visit(duda, 2, 'CANCELADO');
    const o = (await http.get(`/v1/org/reports/overview?from=${addDays(TODAY, -30)}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body;
    expect(o).toMatchObject({ total: 4, concluded: 2, noShows: 1, cancelled: 1, revenueCents: 16000, ticketCents: 8000, clientsServed: 2, returningClients: 1, newClients: 1, returnPct: 50 });
    expect(o.noShowPct).toBe(33.3);
    expect(o.services).toEqual([expect.objectContaining({ name: 'Corte', count: 2, revenueCents: 16000 })]);
    expect(o.members).toHaveLength(1);
    expect(o.members[0].bookedMinutes).toBe(3 * 45); // 2 concluídos + 1 falta ocupam; cancelado libera
    expect(o.members[0].occupancyPct).toBeGreaterThan(0);
    // Período sem nada: sem percentuais inventados.
    const vazio = (await http.get(`/v1/org/reports/overview?from=${addDays(TODAY, -300)}&to=${addDays(TODAY, -290)}`).set(inOrg(dona)).expect(200)).body;
    expect(vazio).toMatchObject({ total: 0, noShowPct: null, ticketCents: null });
  });

  it('clientes sem voltar: só quem passou do prazo, sem horário futuro, mais recentes primeiro', async () => {
    const eva = await client('Eva Sumida');
    const fabio = await client('Fábio Distante');
    await visit(eva, 90, 'CONCLUIDO');
    await visit(fabio, 150, 'CONCLUIDO');
    const list = (await http.get('/v1/org/reports/inactive?dias=60').set(inOrg(dona)).expect(200)).body as { name: string; daysAway: number; visits: number; phone: string | null }[];
    expect(list.map((c) => c.name)).toEqual(['Eva Sumida', 'Fábio Distante', 'Ana Antiga'].filter((n) => n !== 'Ana Antiga'));
    expect(list[0]).toMatchObject({ daysAway: 90, visits: 1 });
    expect(list[0].phone).toBeTruthy();
    // Prazo maior tira quem voltou há menos tempo.
    const long = (await http.get('/v1/org/reports/inactive?dias=120').set(inOrg(dona)).expect(200)).body as { name: string }[];
    expect(long.map((c) => c.name)).toEqual(['Fábio Distante']);
  });

  it('aniversariantes dos próximos dias; outro negócio não vê nada', async () => {
    const in3 = addDays(TODAY, 3);
    await client('Gabi Aniversário', { birthDate: `1990-${in3.slice(5)}` });
    await client('Hugo Longe', { birthDate: `1990-${addDays(TODAY, 120).slice(5)}` });
    const list = (await http.get('/v1/org/reports/birthdays?dias=30').set(inOrg(dona)).expect(200)).body as { name: string; inDays: number; turns: number }[];
    expect(list.map((b) => b.name)).toEqual(['Gabi Aniversário']);
    expect(list[0].inDays).toBe(3);
    const mine = (await http.get(`/v1/org/reports/overview?from=${addDays(TODAY, -30)}&to=${TODAY}`).set(inOrg(outra, otherOrgId)).expect(200)).body;
    expect(mine.total).toBe(0);
    expect((await http.get('/v1/org/reports/inactive').set(inOrg(outra, otherOrgId)).expect(200)).body).toEqual([]);
    expect((await http.get('/v1/org/reports/birthdays').set(inOrg(outra, otherOrgId)).expect(200)).body).toEqual([]);
  });
});
