/**
 * Agenda, clientes e agendamento online contra um Postgres real (banco agendei_test).
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@agendei/contracts';
import { Client } from '../src/agenda/entities/client.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';

/** Uma terça-feira daqui a 1–2 semanas (aberto 9h–19h no horário padrão). */
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const at = (time: string, date = DAY) => zonedToUtc(date, time, TZ).toISOString();

describe('Agenda, clientes e agendamento online (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let orgId = '';
  let slug = '';
  let corte = { id: '', durationMinutes: 0 };
  let members: { id: string; name: string; isMe: boolean }[] = [];
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });
  const memberId = (name: string) => members.find((m) => m.name === name)!.id;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Agenda', 'dona-agenda@agendei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Agenda', {
          team: [
            { name: 'Paula Pro', email: 'paula-agenda@agendei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Mari Sem Acesso', role: 'PROFISSIONAL', bookable: true },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    corte = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0];
    members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body;
  });

  afterAll(async () => {
    await app?.close();
  });

  let anaId = '';
  it('clientes: cadastra, busca por nome e telefone, e cifra as observações', async () => {
    const ana = await http
      .post('/v1/org/clients')
      .set(inOrg(dona))
      .send({ name: 'Ana Cliente', phone: '(11) 91234-5678', notes: 'Alergia a amônia', tags: ['vip', 'vip', ' '] })
      .expect(201);
    anaId = ana.body.id;
    expect(ana.body).toMatchObject({ phone: '11912345678', notes: 'Alergia a amônia', tags: ['vip'] });
    await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Bruno Cliente' }).expect(201);

    expect((await http.get('/v1/org/clients?q=ana').set(inOrg(dona)).expect(200)).body.map((c: { name: string }) => c.name)).toEqual(['Ana Cliente']);
    expect((await http.get('/v1/org/clients?q=1234').set(inOrg(dona)).expect(200)).body).toHaveLength(1);
    expect((await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body).toHaveLength(2);

    const db = app.get(DataSource);
    const [row] = await db.query(`SELECT * FROM ${quotedTable(db, Client)} WHERE id = $1`, [anaId]);
    expect(JSON.stringify(row)).not.toContain('amônia');
  });

  let apptId = '';
  it('agenda: marca, recusa sobreposição e fora do horário; encosta sem problema', async () => {
    const base = { memberId: memberId('Dona Agenda'), serviceId: corte.id };
    const res = await http.post('/v1/org/appointments').set(inOrg(dona)).send({ ...base, clientId: anaId, startsAt: at('10:00') }).expect(201);
    apptId = res.body.id;
    expect(res.body).toMatchObject({ status: 'AGENDADO', clientName: 'Ana Cliente', serviceName: 'Corte', priceCents: 8000, source: 'RECEPCAO' });
    expect(new Date(res.body.endsAt).getTime() - new Date(res.body.startsAt).getTime()).toBe(corte.durationMinutes * 60_000);

    const clash = await http.post('/v1/org/appointments').set(inOrg(dona)).send({ ...base, clientId: anaId, startsAt: at('10:30') }).expect(409);
    expect(clash.body.message).toMatch(/ocupado/);
    // Termina às 10:45: começar às 10:45 encosta, não sobrepõe. Cliente novo criado junto.
    const next = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ ...base, newClient: { name: 'Carla Nova', phone: '11955554444' }, startsAt: at('10:45') })
      .expect(201);
    expect(next.body.clientName).toBe('Carla Nova');
    // Outro profissional no mesmo horário: pode.
    await http.post('/v1/org/appointments').set(inOrg(dona)).send({ ...base, memberId: memberId('Mari Sem Acesso'), clientId: anaId, startsAt: at('10:00') }).expect(201);

    const late = await http.post('/v1/org/appointments').set(inOrg(dona)).send({ ...base, clientId: anaId, startsAt: at('18:30') }).expect(400);
    expect(late.body.message).toMatch(/Fora do horário/);
    await http.post('/v1/org/appointments').set(inOrg(dona)).send({ ...base, clientId: anaId, startsAt: at('18:30'), allowOutsideHours: true }).expect(201);
  });

  it('dia da agenda e horários livres', async () => {
    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day).toMatchObject({ date: DAY, timezone: TZ });
    expect(day.appointments).toHaveLength(4);
    expect(day.professionals.map((p: { name: string }) => p.name)).toEqual(['Dona Agenda', 'Mari Sem Acesso', 'Paula Pro']);
    const slots = (await http.get(`/v1/org/agenda/slots?date=${DAY}&serviceId=${corte.id}&memberId=${memberId('Dona Agenda')}`).set(inOrg(dona)).expect(200))
      .body;
    const starts = slots.slots.map((s: { startsAt: string }) => s.startsAt);
    expect(starts).toContain(at('09:00'));
    expect(starts).not.toContain(at('10:00'));
    expect(starts).not.toContain(at('10:30'));
    expect(starts).toContain(at('11:30'));
  });

  it('status: fluxo do dia; cancelar libera o horário; reabrir confere conflito', async () => {
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).send({ status: 'CHEGOU' }).expect(200);
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).send({ status: 'CONCLUIDO' }).expect(200);
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).send({ status: 'CANCELADO' }).expect(400);
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).send({ status: 'EM_ATENDIMENTO' }).expect(200);
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).send({ status: 'CANCELADO' }).expect(400);

    const other = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Dona Agenda'), serviceId: corte.id, clientId: anaId, startsAt: at('14:00') })
      .expect(201);
    await http.patch(`/v1/org/appointments/${other.body.id}`).set(inOrg(dona)).send({ status: 'CANCELADO' }).expect(200);
    const taken = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Dona Agenda'), serviceId: corte.id, clientId: anaId, startsAt: at('14:00') })
      .expect(201);
    // O cancelado não pode voltar por cima de quem pegou o horário.
    await http.patch(`/v1/org/appointments/${other.body.id}`).set(inOrg(dona)).send({ status: 'AGENDADO' }).expect(409);
    // Remarcar para cima de outro também não.
    await http.patch(`/v1/org/appointments/${taken.body.id}`).set(inOrg(dona)).send({ startsAt: at('10:45') }).expect(409);
    const moved = await http.patch(`/v1/org/appointments/${taken.body.id}`).set(inOrg(dona)).send({ startsAt: at('15:00') }).expect(200);
    expect(moved.body.startsAt).toBe(at('15:00'));
  });

  it('bloqueio da unidade tira o horário de todos', async () => {
    const block = await http
      .post('/v1/org/blocks')
      .set(inOrg(dona))
      .send({ startsAt: at('16:00'), endsAt: at('17:00'), reason: 'Reunião' })
      .expect(201);
    await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Mari Sem Acesso'), serviceId: corte.id, clientId: anaId, startsAt: at('16:15') })
      .expect(409);
    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day.blocks).toEqual([expect.objectContaining({ memberId: null, reason: 'Reunião' })]);
    await http.delete(`/v1/org/blocks/${block.body.id}`).set(inOrg(dona)).expect(204);
    await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Mari Sem Acesso'), serviceId: corte.id, clientId: anaId, startsAt: at('16:15') })
      .expect(201);
  });

  it('profissional só vê e mexe na própria agenda', async () => {
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = outbox.find((m) => m.to === 'paula-agenda@agendei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const paula = await registerUser(http, 'Paula', 'paula-agenda@agendei.test');
    await http.post('/v1/invites/accept').set(paula.auth).send({ token }).expect(201);

    const mine = await http
      .post('/v1/org/appointments')
      .set(inOrg(paula))
      .send({ memberId: memberId('Paula Pro'), serviceId: corte.id, clientId: anaId, startsAt: at('09:00') })
      .expect(201);
    await http
      .post('/v1/org/appointments')
      .set(inOrg(paula))
      .send({ memberId: memberId('Dona Agenda'), serviceId: corte.id, clientId: anaId, startsAt: at('12:00') })
      .expect(403);
    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(paula)).expect(200)).body;
    expect(day.appointments.map((a: { id: string }) => a.id)).toEqual([mine.body.id]);
    expect(day.professionals.map((p: { name: string }) => p.name)).toEqual(['Paula Pro']);
    await http.get(`/v1/org/appointments/${apptId}`).set(inOrg(paula)).expect(404);
    await http.patch(`/v1/org/appointments/${apptId}`).set(inOrg(paula)).send({ notes: 'x' }).expect(403);
    // Profissional não cadastra cliente.
    await http.post('/v1/org/clients').set(inOrg(paula)).send({ name: 'X' }).expect(403);
  });

  it('ficha do cliente: histórico e números', async () => {
    const detail = (await http.get(`/v1/org/clients/${anaId}`).set(inOrg(dona)).expect(200)).body;
    expect(detail.appointments.length).toBeGreaterThanOrEqual(5);
    expect(detail.stats).toMatchObject({ noShows: 0 });
    expect(detail.stats.total).toBe(detail.appointments.filter((a: { status: string }) => a.status !== 'CANCELADO').length);
  });

  it('isolamento: outro negócio não vê agenda, cliente nem agendamento', async () => {
    const outra = await registerUser(http, 'Outra Agenda', 'outra-agenda@agendei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Salão')).expect(201)).body;
    await http.get(`/v1/org/appointments/${apptId}`).set(inOrg(outra, other.id)).expect(404);
    await http.get(`/v1/org/clients/${anaId}`).set(inOrg(outra, other.id)).expect(404);
    expect((await http.get('/v1/org/clients').set(inOrg(outra, other.id)).expect(200)).body).toEqual([]);
    expect((await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(outra, other.id)).expect(200)).body.appointments).toEqual([]);
    const otherSvc = (await http.get('/v1/org/services').set(inOrg(outra, other.id)).expect(200)).body[0];
    // Usar serviço/cliente de outro negócio é recusado.
    await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Dona Agenda'), serviceId: otherSvc.id, clientId: anaId, startsAt: at('12:00') })
      .expect(404);
  });

  let booking = { token: '' };
  it('agendamento online: página, horários e reserva com cliente pelo telefone', async () => {
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page).toMatchObject({ name: 'Salão Agenda', vocabulary: { client: 'Cliente' } });
    expect(page.services.map((s: { name: string }) => s.name)).toEqual(['Corte']);
    expect(page.professionals.map((p: { name: string }) => p.name)).toEqual(['Dona Agenda', 'Mari Sem Acesso', 'Paula Pro']);
    await http.get('/v1/public/orgs/nao-existe').expect(404);

    const slots = (await http.get(`/v1/public/orgs/${slug}/slots?date=${DAY}&serviceId=${corte.id}`).expect(200)).body.slots as {
      startsAt: string;
      memberIds: string[];
    }[];
    const at1130 = slots.find((s) => s.startsAt === at('11:30'))!;
    expect(at1130.memberIds).toEqual(expect.arrayContaining([memberId('Dona Agenda'), memberId('Mari Sem Acesso'), memberId('Paula Pro')]));
    await http.get(`/v1/public/orgs/${slug}/slots?date=${addDays(todayIn(TZ), 90)}&serviceId=${corte.id}`).expect(400);

    const res = await http
      .post(`/v1/public/orgs/${slug}/bookings`)
      .send({ serviceId: corte.id, memberId: memberId('Paula Pro'), startsAt: at('11:30'), name: 'Ana C.', phone: '11 91234-5678', email: 'ana@cliente.test' })
      .expect(201);
    booking = res.body;
    expect(res.body).toMatchObject({ professionalName: 'Paula Pro', serviceName: 'Corte', status: 'AGENDADO', canCancel: true });
    // Mesmo telefone = mesma cliente (não duplica).
    expect((await http.get('/v1/org/clients?q=1234').set(inOrg(dona)).expect(200)).body).toHaveLength(1);
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    expect(outbox.find((m) => m.to === 'ana@cliente.test')!.link).toContain(`/reserva/${res.body.token}`);

    // O mesmo horário com a mesma profissional não está mais disponível; horário fora da grade também não.
    await http
      .post(`/v1/public/orgs/${slug}/bookings`)
      .send({ serviceId: corte.id, memberId: memberId('Paula Pro'), startsAt: at('11:30'), name: 'Outra', phone: '11999990000' })
      .expect(409);
    await http
      .post(`/v1/public/orgs/${slug}/bookings`)
      .send({ serviceId: corte.id, startsAt: at('03:00'), name: 'Madrugada', phone: '11999990001' })
      .expect(409);
    // "Qualquer profissional" pega quem está livre.
    const any = await http
      .post(`/v1/public/orgs/${slug}/bookings`)
      .send({ serviceId: corte.id, startsAt: at('11:30'), name: 'Duda', phone: '11999990002' })
      .expect(201);
    expect(['Dona Agenda', 'Mari Sem Acesso']).toContain(any.body.professionalName);

    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day.appointments.filter((a: { source: string }) => a.source === 'ONLINE')).toHaveLength(2);
  });

  it('cliente vê e cancela pelo link; código errado não acha nada', async () => {
    expect((await http.get(`/v1/public/bookings/${booking.token}`).expect(200)).body.clientName).toBe('Ana Cliente');
    const cancelled = await http.post(`/v1/public/bookings/${booking.token}/cancel`).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELADO', canCancel: false });
    await http.post(`/v1/public/bookings/${booking.token}/cancel`).expect(400);
    await http.get('/v1/public/bookings/codigo-errado').expect(404);
  });

  it('remover da equipe quem tem histórico: some da equipe, o nome fica na agenda', async () => {
    await http.delete(`/v1/org/members/${memberId('Mari Sem Acesso')}`).set(inOrg(dona)).expect(204);
    const team = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { name: string }[];
    expect(team.map((m) => m.name)).not.toContain('Mari Sem Acesso');
    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day.appointments.map((a: { memberName: string }) => a.memberName)).toContain('Mari Sem Acesso');
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page.professionals.map((p: { name: string }) => p.name)).not.toContain('Mari Sem Acesso');
  });

  it('LGPD: excluir cliente apaga os dados e mantém o atendimento sem identificação', async () => {
    const carla = (await http.get('/v1/org/clients?q=Carla').set(inOrg(dona)).expect(200)).body[0];
    await http.delete(`/v1/org/clients/${carla.id}`).set(inOrg(dona)).expect(204);
    await http.get(`/v1/org/clients/${carla.id}`).set(inOrg(dona)).expect(404);
    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day.appointments.map((a: { clientName: string }) => a.clientName)).toContain('Cliente removido');
  });

  it('semana: o mesmo endpoint traz até 7 dias', async () => {
    const week = (await http.get(`/v1/org/agenda?date=${DAY}&days=7`).set(inOrg(dona)).expect(200)).body;
    expect(week).toMatchObject({ date: DAY, days: 7 });
    const inDay = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(week.appointments.length).toBeGreaterThanOrEqual(inDay.appointments.length);
    await http.get(`/v1/org/agenda?date=${DAY}&days=8`).set(inOrg(dona)).expect(400);
  });

  it('lista de espera: pedido, vaga aberta no cancelamento e resolução', async () => {
    const entry = await http
      .post('/v1/org/waitlist')
      .set(inOrg(dona))
      .send({ newClient: { name: 'Espera Ansiosa', phone: '11977776666' }, memberId: memberId('Dona Agenda'), preferredDate: DAY, notes: 'Qualquer horário' })
      .expect(201);
    expect(entry.body).toMatchObject({ clientName: 'Espera Ansiosa', memberName: 'Dona Agenda', preferredDate: DAY, openSlot: null });
    // Outro pedido que não combina (outro dia).
    await http.post('/v1/org/waitlist').set(inOrg(dona)).send({ clientId: anaId, preferredDate: addDays(DAY, 1) }).expect(201);

    const appt = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: memberId('Dona Agenda'), serviceId: corte.id, clientId: anaId, startsAt: at('17:00') })
      .expect(201);
    await http.patch(`/v1/org/appointments/${appt.body.id}`).set(inOrg(dona)).send({ status: 'CANCELADO' }).expect(200);

    const list = (await http.get('/v1/org/waitlist').set(inOrg(dona)).expect(200)).body as { id: string; clientName: string; openSlot: unknown }[];
    expect(list.find((e) => e.clientName === 'Espera Ansiosa')!.openSlot).toEqual({
      startsAt: at('17:00'),
      memberId: memberId('Dona Agenda'),
      memberName: 'Dona Agenda',
    });
    expect(list.find((e) => e.clientName === 'Ana Cliente')!.openSlot).toBeNull();

    const outra = await registerUser(http, 'Outra Espera', 'outra-espera@agendei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Espera')).expect(201)).body;
    await http.delete(`/v1/org/waitlist/${entry.body.id}`).set(inOrg(outra, other.id)).expect(404);
    expect((await http.get('/v1/org/waitlist').set(inOrg(outra, other.id)).expect(200)).body).toEqual([]);

    await http.delete(`/v1/org/waitlist/${entry.body.id}`).set(inOrg(dona)).expect(204);
    const after = (await http.get('/v1/org/waitlist').set(inOrg(dona)).expect(200)).body as { clientName: string }[];
    expect(after.map((e) => e.clientName)).toEqual(['Ana Cliente']);
  });

  it('horário próprio do profissional limita a agenda e o agendamento online', async () => {
    const paulaId = memberId('Paula Pro');
    const hours = [[], [], [{ start: '13:00', end: '17:00' }], [], [], [], []];
    const updated = await http.patch(`/v1/org/members/${paulaId}`).set(inOrg(dona)).send({ workingHours: hours }).expect(200);
    expect(updated.body.workingHours).toEqual(hours);
    await http.patch(`/v1/org/members/${paulaId}`).set(inOrg(dona)).send({ workingHours: [[]] }).expect(400);

    const day = (await http.get(`/v1/org/agenda?date=${DAY}`).set(inOrg(dona)).expect(200)).body;
    expect(day.professionals.find((p: { id: string }) => p.id === paulaId).hours[2]).toEqual([{ start: '13:00', end: '17:00' }]);

    const slots = (await http.get(`/v1/public/orgs/${slug}/slots?date=${DAY}&serviceId=${corte.id}&memberId=${paulaId}`).expect(200)).body.slots as {
      startsAt: string;
    }[];
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.startsAt >= at('13:00') && s.startsAt < at('17:00'))).toBe(true);

    const outside = await http
      .post('/v1/org/appointments')
      .set(inOrg(dona))
      .send({ memberId: paulaId, serviceId: corte.id, clientId: anaId, startsAt: at('12:00') })
      .expect(400);
    expect(outside.body.message).toMatch(/Fora do horário/);
    await http.post('/v1/org/appointments').set(inOrg(dona)).send({ memberId: paulaId, serviceId: corte.id, clientId: anaId, startsAt: at('14:00') }).expect(201);

    // Voltar a seguir a unidade.
    const reset = await http.patch(`/v1/org/members/${paulaId}`).set(inOrg(dona)).send({ workingHours: null }).expect(200);
    expect(reset.body.workingHours).toBeNull();
  });

  it('agendamento online: o mesmo telefone mantém no máximo 3 horários futuros', async () => {
    const corte = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body.services[0];
    const offered = (await http.get(`/v1/public/orgs/${slug}/slots?date=${DAY}&serviceId=${corte.id}`).expect(200)).body.slots as { startsAt: string }[];
    // Quatro horários livres sem encostar um no outro (o mesmo telefone não pode estar em dois lugares).
    const free: string[] = [];
    for (const s of offered) if (!free.length || new Date(s.startsAt).getTime() - new Date(free.at(-1)!).getTime() >= 60 * 60_000) free.push(s.startsAt);
    expect(free.length).toBeGreaterThanOrEqual(4);
    const phone = '11955550000';
    for (const startsAt of free.slice(0, 3)) {
      await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId: corte.id, startsAt, name: 'Acumuladora', phone }).expect(201);
    }
    const blocked = await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId: corte.id, startsAt: free[3], name: 'Acumuladora', phone }).expect(409);
    expect(blocked.body.message).toMatch(/3 horários marcados/);
    // Outro telefone segue livre.
    await http.post(`/v1/public/orgs/${slug}/bookings`).send({ serviceId: corte.id, startsAt: free[3], name: 'Outra Pessoa', phone: '11955551111' }).expect(201);
  });
});
