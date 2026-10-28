/**
 * Caixa, comandas, formas de pagamento, comissões e resumo financeiro (banco agendei_test).
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@agendei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';

function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const TODAY = todayIn(TZ);

describe('Caixa, comandas e comissões (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let paula: Session;
  let rita: Session;
  let orgId = '';
  let corte = { id: '' };
  let members: { id: string; name: string }[] = [];
  let anaId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });
  const memberId = (name: string) => members.find((m) => m.name === name)!.id;

  /** Aceita o convite mais recente enviado para `email`. */
  async function join(name: string, email: string): Promise<Session> {
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = outbox.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Caixa', 'dona-caixa@agendei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Caixa', {
          team: [
            { name: 'Paula Pro', email: 'paula-caixa@agendei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Rita Recepção', email: 'rita-caixa@agendei.test', role: 'RECEPCAO', bookable: false },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    corte = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0];
    members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body;
    paula = await join('Paula', 'paula-caixa@agendei.test');
    rita = await join('Rita', 'rita-caixa@agendei.test');
    anaId = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Ana Cliente' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('configura taxas e comissão', async () => {
    const org = await http
      .patch('/v1/org')
      .set(inOrg(dona))
      .send({ paymentMethods: [{ method: 'CARTAO_CREDITO', enabled: true, feeBps: 300, feeFixedCents: 0, settlementDays: 30 }] })
      .expect(200);
    expect(org.body.paymentMethods).toHaveLength(6);
    expect(org.body.paymentMethods.find((m: { method: string }) => m.method === 'CARTAO_CREDITO').feeBps).toBe(300);
    expect(org.body.commissionBase).toBe('BRUTO');
    await http.patch('/v1/org').set(inOrg(dona)).send({ paymentMethods: [{ method: 'PIX', enabled: true, feeBps: 9999, feeFixedCents: 0, settlementDays: 0 }] }).expect(400);
    await http.patch('/v1/org').set(inOrg(rita)).send({ commissionBase: 'LIQUIDO' }).expect(403);

    const pro = await http.patch(`/v1/org/members/${memberId('Paula Pro')}`).set(inOrg(dona)).send({ commissionBps: 4000 }).expect(200);
    expect(pro.body.commissionBps).toBe(4000);
  });

  it('sem caixa aberto não recebe; abre uma vez só', async () => {
    const o = await http.post('/v1/org/orders').set(inOrg(rita)).send({}).expect(201);
    await http.post(`/v1/org/orders/${o.body.id}/items`).set(inOrg(rita)).send({ kind: 'AVULSO', description: 'Teste', unitPriceCents: 100 }).expect(201);
    const res = await http.post(`/v1/org/orders/${o.body.id}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: 100 }).expect(400);
    expect(res.body.message).toMatch(/Abra o caixa/);
    await http.post(`/v1/org/orders/${o.body.id}/cancel`).set(inOrg(rita)).expect(200);

    const cash = await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 10000 }).expect(201);
    expect(cash.body).toMatchObject({ status: 'ABERTO', openingCents: 10000, openedByName: 'Rita Recepção' });
    await http.post('/v1/org/cash/open').set(inOrg(dona)).send({ openingCents: 0 }).expect(409);
  });

  let orderId = '';
  let apptId = '';
  it('comanda do check-in: atendimento + produto, desconto, pagamento dividido e fechamento', async () => {
    apptId = (
      await http
        .post('/v1/org/appointments')
        .set(inOrg(dona))
        .send({ memberId: memberId('Paula Pro'), serviceId: corte.id, clientId: anaId, startsAt: zonedToUtc(DAY, '10:00', TZ).toISOString() })
        .expect(201)
    ).body.id;
    const o = await http.post('/v1/org/orders').set(inOrg(rita)).send({ appointmentIds: [apptId] }).expect(201);
    orderId = o.body.id;
    expect(o.body).toMatchObject({ status: 'ABERTA', clientName: 'Ana Cliente' });
    expect(o.body.items).toEqual([expect.objectContaining({ description: 'Corte', unitPriceCents: 8000, memberName: 'Paula Pro', appointmentId: apptId })]);
    // Check-in marca "Chegou" e a agenda sabe da comanda.
    const appt = (await http.get(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).expect(200)).body;
    expect(appt).toMatchObject({ status: 'CHEGOU', orderId });
    await http.post('/v1/org/orders').set(inOrg(rita)).send({ appointmentIds: [apptId] }).expect(409);

    await http
      .post(`/v1/org/orders/${orderId}/items`)
      .set(inOrg(rita))
      .send({ kind: 'AVULSO', description: 'Pomada', unitPriceCents: 3000, memberId: memberId('Paula Pro') })
      .expect(201);
    const disc = await http.patch(`/v1/org/orders/${orderId}`).set(inOrg(rita)).send({ discountCents: 1000 }).expect(200);
    expect(disc.body.totals).toMatchObject({ subtotalCents: 11000, discountCents: 1000, totalCents: 10000, dueCents: 10000 });
    expect(disc.body.items.map((i: { netCents: number }) => i.netCents)).toEqual([7273, 2727]);

    await http.post(`/v1/org/orders/${orderId}/close`).set(inOrg(rita)).expect(400);
    const card = await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(rita)).send({ method: 'CARTAO_CREDITO', amountCents: 6000 }).expect(201);
    expect(card.body.payments[0]).toMatchObject({ method: 'CARTAO_CREDITO', amountCents: 6000, feeCents: 180 });
    await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: 5000 }).expect(400);
    await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(rita)).send({ method: 'TRANSFERENCIA', amountCents: 100 }).expect(400);
    // Tirar item depois de pago a mais não pode.
    const pomada = card.body.items.find((i: { description: string }) => i.description === 'Pomada');
    await http.delete(`/v1/org/orders/${orderId}/items/${pomada.id}`).set(inOrg(rita)).expect(200);
    await http
      .post(`/v1/org/orders/${orderId}/items`)
      .set(inOrg(rita))
      .send({ kind: 'AVULSO', description: 'Pomada', unitPriceCents: 3000, memberId: memberId('Paula Pro') })
      .expect(201);
    await http.patch(`/v1/org/orders/${orderId}`).set(inOrg(rita)).send({ discountCents: 9000 }).expect(400);

    await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(rita)).send({ method: 'DINHEIRO', amountCents: 4000 }).expect(201);
    const closed = await http.post(`/v1/org/orders/${orderId}/close`).set(inOrg(rita)).expect(200);
    expect(closed.body).toMatchObject({ status: 'FECHADA' });
    expect(closed.body.totals).toMatchObject({ totalCents: 10000, paidCents: 10000, dueCents: 0, feesCents: 180 });
    expect((await http.get(`/v1/org/appointments/${apptId}`).set(inOrg(dona)).expect(200)).body.status).toBe('CONCLUIDO');
    await http.post(`/v1/org/orders/${orderId}/items`).set(inOrg(rita)).send({ kind: 'AVULSO', description: 'X', unitPriceCents: 1 }).expect(400);
  });

  it('comissão: 40% sobre o valor com desconto; profissional vê só a dela', async () => {
    const balances = (await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body;
    expect(balances).toEqual([expect.objectContaining({ memberName: 'Paula Pro', commissionsCents: 2909 + 1091, balanceCents: 4000, entries: 2 })]);
    const own = (await http.get('/v1/org/commissions/entries').set(inOrg(paula)).expect(200)).body;
    expect(own.map((e: { amountCents: number }) => e.amountCents).sort()).toEqual([1091, 2909]);
    await http.get(`/v1/org/commissions/entries?memberId=${memberId('Dona Caixa')}`).set(inOrg(paula)).expect(403);
    // Recepção não vê comissão nem resultado; profissional não mexe em comanda nem fecha comissão.
    await http.get('/v1/org/commissions/balances').set(inOrg(rita)).expect(403);
    await http.get(`/v1/org/finance/summary?from=${TODAY}&to=${TODAY}`).set(inOrg(rita)).expect(403);
    await http.get('/v1/org/orders').set(inOrg(paula)).expect(403);
    await http.post('/v1/org/commissions/payouts').set(inOrg(paula)).send({ memberId: memberId('Paula Pro') }).expect(403);
  });

  it('vale e fechamento de comissão', async () => {
    await http.post('/v1/org/commissions/advances').set(inOrg(dona)).send({ memberId: memberId('Paula Pro'), amountCents: 1000, note: 'Vale' }).expect(201);
    const balance = (await http.get('/v1/org/commissions/balances').set(inOrg(paula)).expect(200)).body[0];
    expect(balance).toMatchObject({ commissionsCents: 4000, advancesCents: 1000, balanceCents: 3000 });
    const payout = await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: memberId('Paula Pro') }).expect(201);
    expect(payout.body).toMatchObject({ commissionsCents: 4000, advancesCents: 1000, totalCents: 3000, entries: 2 });
    expect((await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body).toEqual([]);
    await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: memberId('Paula Pro') }).expect(400);
    expect((await http.get('/v1/org/commissions/payouts').set(inOrg(paula)).expect(200)).body).toHaveLength(1);
    // Comanda com comissão já paga não estorna.
    await http.post(`/v1/org/orders/${orderId}/cancel`).set(inOrg(rita)).expect(400);
  });

  it('estorno devolve pagamentos e some do resumo; sangria e conferência do caixa', async () => {
    const o = (await http.post('/v1/org/orders').set(inOrg(rita)).send({ clientId: anaId }).expect(201)).body;
    await http.post(`/v1/org/orders/${o.id}/items`).set(inOrg(rita)).send({ kind: 'SERVICO', serviceId: corte.id, memberId: memberId('Paula Pro') }).expect(201);
    await http.post(`/v1/org/orders/${o.id}/payments`).set(inOrg(rita)).send({ method: 'DINHEIRO', amountCents: 8000 }).expect(201);
    await http.post(`/v1/org/orders/${o.id}/close`).set(inOrg(rita)).expect(200);
    expect((await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body[0].commissionsCents).toBe(3200);
    const cancelled = await http.post(`/v1/org/orders/${o.id}/cancel`).set(inOrg(rita)).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELADA', payments: [] });
    expect((await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body).toEqual([]);

    // Gaveta: 100,00 de troco + 40,00 em dinheiro.
    const big = await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SANGRIA', amountCents: 100_000 }).expect(400);
    expect(big.body.message).toMatch(/maior que o dinheiro/);
    const cash = (await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SANGRIA', amountCents: 2000, note: 'Banco' }).expect(201)).body;
    expect(cash.expected.drawerCents).toBe(10000 + 4000 - 2000);
    expect(cash.expected.byMethod).toMatchObject({ DINHEIRO: 4000, CARTAO_CREDITO: 6000 });

    // Comanda aberta com pagamento segura o fechamento.
    const pend = (await http.post('/v1/org/orders').set(inOrg(rita)).send({}).expect(201)).body;
    await http.post(`/v1/org/orders/${pend.id}/items`).set(inOrg(rita)).send({ kind: 'AVULSO', description: 'Água', unitPriceCents: 500 }).expect(201);
    const paid = (await http.post(`/v1/org/orders/${pend.id}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: 200 }).expect(201)).body;
    await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 12000 }).expect(400);
    await http.delete(`/v1/org/orders/${pend.id}/payments/${paid.payments[0].id}`).set(inOrg(rita)).expect(200);

    const closed = await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 11900 }).expect(201);
    expect(closed.body).toMatchObject({ status: 'FECHADO', countedCents: 11900, differenceCents: -100, closedByName: 'Rita Recepção' });
    expect((await http.get('/v1/org/cash/current').set(inOrg(rita)).expect(200)).body).toEqual({});
    await http.post(`/v1/org/orders/${pend.id}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: 500 }).expect(400);
    expect((await http.get('/v1/org/cash/history').set(inOrg(dona)).expect(200)).body).toHaveLength(1);
  });

  it('resumo financeiro do dia', async () => {
    const s = (await http.get(`/v1/org/finance/summary?from=${TODAY}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body;
    expect(s).toMatchObject({
      orders: 1,
      grossCents: 11000,
      discountsCents: 1000,
      revenueCents: 10000,
      feesCents: 180,
      netCents: 9820,
      commissionsCents: 4000,
      averageTicketCents: 10000,
    });
    expect(s.byMethod).toEqual([
      { method: 'CARTAO_CREDITO', amountCents: 6000, feesCents: 180 },
      { method: 'DINHEIRO', amountCents: 4000, feesCents: 0 },
    ]);
    expect(s.byProfessional).toEqual([expect.objectContaining({ name: 'Paula Pro', revenueCents: 10000, commissionsCents: 4000, items: 2 })]);
    expect(s.byDay).toEqual([{ date: TODAY, revenueCents: 10000 }]);
    await http.get(`/v1/org/finance/summary?from=${TODAY}&to=${addDays(TODAY, -1)}`).set(inOrg(dona)).expect(400);
  });

  it('isolamento entre negócios e remoção de quem tem histórico financeiro', async () => {
    const outra = await registerUser(http, 'Outra Caixa', 'outra-caixa@agendei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Caixa')).expect(201)).body;
    await http.get(`/v1/org/orders/${orderId}`).set(inOrg(outra, other.id)).expect(404);
    expect((await http.get('/v1/org/orders').set(inOrg(outra, other.id)).expect(200)).body).toEqual([]);
    expect((await http.get('/v1/org/commissions/payouts').set(inOrg(outra, other.id)).expect(200)).body).toEqual([]);

    await http.delete(`/v1/org/members/${memberId('Rita Recepção')}`).set(inOrg(dona)).expect(204);
    const team = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { name: string }[];
    expect(team.map((m) => m.name)).not.toContain('Rita Recepção');
    expect((await http.get('/v1/org/cash/history').set(inOrg(dona)).expect(200)).body[0].openedByName).toBe('Rita Recepção');
  });
});
