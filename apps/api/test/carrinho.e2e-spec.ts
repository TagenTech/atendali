/**
 * Reserva com vários procedimentos (carrinho): em sequência, em horários separados, tudo ou nada, um link só.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const at = (time: string, date = DAY) => zonedToUtc(date, time, TZ).toISOString();
interface Item {
  id: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  clientName: string;
}

describe('Carrinho de procedimentos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let orgId = '';
  let slug = '';
  let svc: Record<string, string> = {};
  const inOrg = () => ({ ...dona.auth, [ORG_HEADER]: orgId });
  const group = (body: Record<string, unknown>) => http.post(`/v1/public/orgs/${slug}/bookings/group`).send({ name: 'Mariana Costa', phone: '11988887777', email: 'mariana@exemplo.test', ...body });
  const dayAppointments = async (date = DAY) => (await http.get(`/v1/org/agenda?date=${date}`).set(inOrg()).expect(200)).body.appointments as { id: string; status: string }[];

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Carrinho', 'dona-carrinho@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Carrinho', {
          services: [
            { name: 'Corte', category: 'Cabelo', durationMinutes: 40, priceCents: 5000 },
            { name: 'Barba', category: 'Barba', durationMinutes: 20, priceCents: 3000 },
            { name: 'Hidratação', category: 'Cabelo', durationMinutes: 60, priceCents: 9000 },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    svc = Object.fromEntries(page.services.map((s: { id: string; name: string }) => [s.name, s.id]));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('em sequência: sugere inícios em que um procedimento começa quando o outro acaba', async () => {
    const r = await http.get(`/v1/public/orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${svc.Corte},${svc.Barba}`).expect(200);
    expect(r.body.options.length).toBeGreaterThan(10);
    for (const o of r.body.options as { startsAt: string; items: { serviceId: string; memberId: string; startsAt: string; endsAt: string }[] }[]) {
      expect(o.items.map((i) => i.serviceId)).toEqual([svc.Corte, svc.Barba]);
      expect(o.items[1].startsAt).toBe(o.items[0].endsAt);
      expect(o.startsAt).toBe(o.items[0].startsAt);
    }
    // Último encaixe termina até as 19h (40 + 20 min).
    const last = r.body.options.at(-1);
    expect(new Date(last.items[1].endsAt).getTime()).toBeLessThanOrEqual(new Date(at('19:00')).getTime());
    // Validações da consulta.
    await http.get(`/v1/public/orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${svc.Corte}`).expect(400);
    await http.get(`/v1/public/orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=abc,def`).expect(400);
  });

  let token = '';
  let items: Item[] = [];

  it('reserva dois procedimentos em sequência com um link só e um paciente', async () => {
    const seq = (await http.get(`/v1/public/orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${svc.Corte},${svc.Barba}`).expect(200)).body.options[0];
    const res = await group({ items: seq.items.map((i: { serviceId: string; memberId: string; startsAt: string }) => ({ serviceId: i.serviceId, memberId: i.memberId, startsAt: i.startsAt })) }).expect(201);
    token = res.body.token;
    items = res.body.items;
    expect(items.map((i) => i.serviceName)).toEqual(['Corte', 'Barba']);
    expect(items[1].startsAt).toBe(items[0].endsAt);
    expect(new Set(items.map((i) => i.clientName)).size).toBe(1);
    // O mesmo link mostra tudo; o link antigo (de um agendamento) continua respondendo com o primeiro.
    expect((await http.get(`/v1/public/bookings/${token}/group`).expect(200)).body.items).toHaveLength(2);
    expect((await http.get(`/v1/public/bookings/${token}`).expect(200)).body.serviceName).toBe('Corte');
    // Na agenda da clínica entram os dois, e é um paciente só.
    expect((await dayAppointments()).filter((a) => items.some((i) => i.id === a.id))).toHaveLength(2);
    expect((await http.get('/v1/org/clients').set(inOrg()).expect(200)).body).toHaveLength(1);
    // E o e-mail é um só, com os dois procedimentos.
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; subject: string; link?: string }[];
    const mails = box.filter((m) => m.to === 'mariana@exemplo.test' && m.link?.includes(`/reserva/${token}`));
    expect(mails).toHaveLength(1);
  });

  it('tudo ou nada: um horário inválido derruba a reserva inteira', async () => {
    const before = (await dayAppointments()).length;
    await group({ phone: '11977776666', items: [{ serviceId: svc.Hidratação, startsAt: at('15:00') }, { serviceId: svc.Barba, startsAt: at('03:00') }] }).expect(409);
    expect((await dayAppointments()).length).toBe(before);
  });

  it('dois procedimentos no mesmo horário são recusados; encostar pode', async () => {
    await group({ phone: '11977776666', items: [{ serviceId: svc.Hidratação, startsAt: at('15:00') }, { serviceId: svc.Barba, startsAt: at('15:30') }] }).expect(400);
    const ok = await group({ phone: '11977776666', name: 'Paula', items: [{ serviceId: svc.Hidratação, startsAt: at('15:00') }, { serviceId: svc.Barba, startsAt: at('16:00') }] }).expect(201);
    expect(ok.body.items).toHaveLength(2);
  });

  it('limites: no máximo 5 procedimentos por reserva e o teto de horários do telefone vale para o grupo', async () => {
    const many = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45'].map((t) => ({ serviceId: svc.Barba, startsAt: at(t, addDays(DAY, 7)) }));
    await group({ phone: '11955550000', items: many }).expect(400);
    await group({ phone: '11955550000', items: [] }).expect(400);
    // Paula já tem 2 ativos: mais 4 estouram o teto de 5.
    const four = ['09:00', '09:45', '10:30', '11:15'].map((t) => ({ serviceId: svc.Barba, startsAt: at(t, addDays(DAY, 7)) }));
    const blocked = await group({ phone: '11977776666', name: 'Paula', items: four }).expect(409);
    expect(blocked.body.message).toMatch(/limite é 5/);
  });

  it('remarca e cancela um procedimento sem mexer nos outros', async () => {
    // Com mais de um procedimento é preciso dizer qual.
    await http.post(`/v1/public/bookings/${token}/group/reschedule`).send({ startsAt: at('17:00') }).expect(400);
    const moved = await http.post(`/v1/public/bookings/${token}/group/reschedule`).send({ itemId: items[1].id, startsAt: at('17:00') }).expect(200);
    expect(moved.body.items.find((i: Item) => i.id === items[1].id).startsAt).toBe(at('17:00'));
    expect(moved.body.items.find((i: Item) => i.id === items[0].id).startsAt).toBe(items[0].startsAt);
    // Item de outra reserva não é alcançável por este link.
    const other = (await dayAppointments()).find((a) => !items.some((i) => i.id === a.id))!;
    await http.post(`/v1/public/bookings/${token}/group/cancel`).send({ itemId: other.id }).expect(404);

    const one = await http.post(`/v1/public/bookings/${token}/group/cancel`).send({ itemId: items[1].id }).expect(200);
    expect(one.body.items.map((i: Item) => i.status)).toEqual(['AGENDADO', 'CANCELADO']);
    const all = await http.post(`/v1/public/bookings/${token}/group/cancel`).send({}).expect(200);
    expect(all.body.items.map((i: Item) => i.status)).toEqual(['CANCELADO', 'CANCELADO']);
    // Nada mais a cancelar.
    await http.post(`/v1/public/bookings/${token}/group/cancel`).send({}).expect(400);
    await http.get('/v1/public/bookings/token-que-nao-existe/group').expect(404);
  });

  it('um procedimento só pelo mesmo endpoint segue o fluxo antigo (um link por agendamento)', async () => {
    const r = await group({ phone: '11944443333', name: 'Lia', items: [{ serviceId: svc.Corte, startsAt: at('09:00', addDays(DAY, 14)) }] }).expect(201);
    expect(r.body.items).toHaveLength(1);
    const legacy = await http.get(`/v1/public/bookings/${r.body.token}`).expect(200);
    expect(legacy.body.serviceName).toBe('Corte');
    await http.post(`/v1/public/bookings/${r.body.token}/cancel`).expect(200);
  });
});
