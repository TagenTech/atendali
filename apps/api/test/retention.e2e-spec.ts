/**
 * Fase 3 contra um Postgres real: estoque e ficha técnica, pacotes, clube, vale-presente, fidelidade,
 * avaliações e painel de TV — todos passando pela comanda (banco skedulei_test).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, cycleEnd, ORG_HEADER, todayIn } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
const TODAY = todayIn(TZ);

describe('Estoque, pacotes, clube, vales, pontos, avaliações e TV (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let paula: Session;
  let rita: Session;
  let orgId = '';
  let slug = '';
  let corte = { id: '' };
  let members: { id: string; name: string }[] = [];
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });
  const memberId = (name: string) => members.find((m) => m.name === name)!.id;

  async function join(name: string, email: string): Promise<Session> {
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = outbox.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }
  const newClient = async (name: string) => (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name, phone: `119${Math.floor(10_000_000 + Math.random() * 89_999_999)}` }).expect(201)).body.id as string;
  const order = async (clientId?: string) => (await http.post('/v1/org/orders').set(inOrg(rita)).send(clientId ? { clientId } : {}).expect(201)).body.id as string;
  const addItem = (orderId: string, body: object) => http.post(`/v1/org/orders/${orderId}/items`).set(inOrg(rita)).send(body);
  const pay = (orderId: string, body: object) => http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(rita)).send(body);
  const close = (orderId: string) => http.post(`/v1/org/orders/${orderId}/close`).set(inOrg(rita));
  const cancel = (orderId: string) => http.post(`/v1/org/orders/${orderId}/cancel`).set(inOrg(rita));
  /** Comanda de um item, paga em PIX e fechada. */
  async function sell(clientId: string | undefined, item: object, total: number) {
    const id = await order(clientId);
    await addItem(id, item).expect(201);
    if (total > 0) await pay(id, { method: 'PIX', amountCents: total }).expect(201);
    await close(id).expect(200);
    return id;
  }
  const product = async (name: string) => ((await http.get('/v1/org/stock/products').set(inOrg(rita)).expect(200)).body as { id: string; name: string; quantity: number; costCents: number }[]).find((p) => p.name === name)!;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Retenção', 'dona-ret@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Retenção', {
          team: [
            { name: 'Paula Pro', email: 'paula-ret@skedulei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Rita Recepção', email: 'rita-ret@skedulei.test', role: 'RECEPCAO', bookable: false },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    slug = org.body.slug;
    corte = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0];
    members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body;
    paula = await join('Paula', 'paula-ret@skedulei.test');
    rita = await join('Rita', 'rita-ret@skedulei.test');
    await http.patch(`/v1/org/members/${memberId('Paula Pro')}`).set(inOrg(dona)).send({ commissionBps: 4000 }).expect(200);
    await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 0 }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('módulos desligados recusam as rotas, com mensagem clara; ligar libera', async () => {
    await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['COMISSOES'] }).expect(200);
    for (const path of ['/v1/org/stock/products', '/v1/org/package-plans', '/v1/org/membership-plans', '/v1/org/gift-cards']) {
      const res = await http.get(path).set(inOrg(dona)).expect(403);
      expect(res.body.message).toMatch(/módulo está desligado/);
    }
    const ana = await newClient('Ana Cliente');
    await addItem(await order(ana), { kind: 'PACOTE', refId: '00000000-0000-4000-8000-000000000000' }).expect(403);
    await http
      .patch('/v1/org')
      .set(inOrg(dona))
      .send({ features: ['ESTOQUE', 'PACOTES', 'ASSINATURAS', 'VALES', 'FIDELIDADE'] })
      .expect(200);
    await http.get('/v1/org/stock/products').set(inOrg(dona)).expect(200);
  });

  // ------------------------------------------------------------------ estoque

  it('estoque: custo médio nas entradas, saída não passa do saldo, inventário e permissões', async () => {
    await http.post('/v1/org/stock/products').set(inOrg(rita)).send({ name: 'X', kind: 'INSUMO' }).expect(403);
    await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Pomada', kind: 'VENDA' }).expect(400);
    const pomada = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Pomada', kind: 'VENDA', salePriceCents: 3000 }).expect(201)).body;
    const toxina = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Toxina', kind: 'INSUMO', unit: 'U', minQuantity: 100 }).expect(201)).body;
    expect(toxina).toMatchObject({ quantity: 0, status: 'ZERADO', unit: 'U', salePriceCents: null });

    await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: pomada.id, kind: 'ENTRADA', quantity: 10, unitCostCents: 1200 }).expect(201);
    const second = await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: pomada.id, kind: 'ENTRADA', quantity: 10, unitCostCents: 1800 }).expect(201);
    expect(second.body).toMatchObject({ quantity: 20, costCents: 1500, valueCents: 30_000, status: 'OK' });

    await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: toxina.id, kind: 'ENTRADA', quantity: 500, unitCostCents: 10 }).expect(201);
    const big = await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: toxina.id, kind: 'SAIDA', quantity: 501 }).expect(400);
    expect(big.body.message).toMatch(/maior que o estoque/);
    await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: toxina.id, kind: 'SAIDA', quantity: 0 }).expect(400);
    const inv = await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: toxina.id, kind: 'AJUSTE', quantity: 480, note: 'Contagem' }).expect(201);
    expect(inv.body.quantity).toBe(480);
    await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: toxina.id, kind: 'AJUSTE', quantity: 500, note: 'Recontagem' }).expect(201);

    // Ficha técnica: só insumo; Corte consome 50 U.
    await http.put(`/v1/org/stock/services/${corte.id}/supplies`).set(inOrg(dona)).send({ supplies: [{ productId: pomada.id, quantity: 1 }] }).expect(400);
    const sup = await http.put(`/v1/org/stock/services/${corte.id}/supplies`).set(inOrg(dona)).send({ supplies: [{ productId: toxina.id, quantity: 50 }] }).expect(200);
    expect(sup.body).toEqual([{ productId: toxina.id, productName: 'Toxina', unit: 'U', quantity: 50 }]);
    expect((await http.get(`/v1/org/stock/services/${corte.id}/supplies`).set(inOrg(rita)).expect(200)).body).toHaveLength(1);
    await http.put(`/v1/org/stock/services/${corte.id}/supplies`).set(inOrg(rita)).send({ supplies: [] }).expect(403);
  });

  it('comanda com produto e serviço baixa o estoque no fechamento; estorno devolve', async () => {
    const ana = await newClient('Ana Estoque');
    const id = await order(ana);
    await addItem(id, { kind: 'PRODUTO', refId: (await product('Pomada')).id, quantity: 2, memberId: memberId('Paula Pro') }).expect(201);
    const priced = await addItem(id, { kind: 'SERVICO', serviceId: corte.id, memberId: memberId('Paula Pro') }).expect(201);
    expect(priced.body.items.map((i: { description: string; unitPriceCents: number }) => [i.description, i.unitPriceCents])).toEqual([
      ['Pomada', 3000],
      ['Corte', 8000],
    ]);
    // Nada baixa antes de fechar.
    expect((await product('Pomada')).quantity).toBe(20);
    await pay(id, { method: 'PIX', amountCents: 14_000 }).expect(201);
    await close(id).expect(200);
    expect((await product('Pomada')).quantity).toBe(18);
    expect((await product('Toxina')).quantity).toBe(450);

    const moves = (await http.get('/v1/org/stock/movements').set(inOrg(dona)).expect(200)).body as { kind: string; quantity: number; orderNumber: number | null; productName: string }[];
    expect(moves.filter((m) => m.orderNumber !== null).map((m) => [m.productName, m.kind, m.quantity]).sort()).toEqual([
      ['Pomada', 'VENDA', -2],
      ['Toxina', 'CONSUMO', -50],
    ]);
    const report = (await http.get('/v1/org/stock/report').set(inOrg(dona)).expect(200)).body;
    expect(report.items.find((i: { name: string }) => i.name === 'Toxina')).toMatchObject({ abc: expect.stringMatching(/^[ABC]$/), status: 'OK' });
    expect(report.totalValueCents).toBe(18 * 1500 + 450 * 10);

    await cancel(id).expect(200);
    expect((await product('Pomada')).quantity).toBe(20);
    expect((await product('Toxina')).quantity).toBe(500);
  });

  // ------------------------------------------------------------------ pacotes

  let planId = '';
  let ana = '';
  it('pacote: plano, venda pela comanda e saldo do cliente', async () => {
    await http.post('/v1/org/package-plans').set(inOrg(rita)).send({ name: 'x', serviceId: corte.id, sessions: 5, priceCents: 100 }).expect(403);
    await http.post('/v1/org/package-plans').set(inOrg(dona)).send({ name: 'x', serviceId: corte.id, sessions: 1, priceCents: 100 }).expect(400);
    const plan = (await http.post('/v1/org/package-plans').set(inOrg(dona)).send({ name: '5 cortes', serviceId: corte.id, sessions: 5, priceCents: 20_000, validityDays: 30 }).expect(201)).body;
    planId = plan.id;
    expect(plan).toMatchObject({ serviceName: 'Corte', sessions: 5, validityDays: 30, active: true });

    ana = await newClient('Ana Pacote');
    // Sem cliente na comanda não vende pacote.
    await addItem(await order(), { kind: 'PACOTE', refId: planId }).expect(400);
    await sell(ana, { kind: 'PACOTE', refId: planId }, 20_000);
    const cp = (await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body;
    expect(cp).toEqual([expect.objectContaining({ planName: '5 cortes', sessionsLeft: 5, sessionsUsed: 0, priceCents: 20_000, status: 'ATIVO', expiresAt: addDays(TODAY, 30), purchasedAt: TODAY })]);
    // Mudar o preço do plano não mexe no que ela comprou.
    await http.patch(`/v1/org/package-plans/${planId}`).set(inOrg(dona)).send({ priceCents: 30_000 }).expect(200);
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0].priceCents).toBe(20_000);
    await http.patch(`/v1/org/package-plans/${planId}`).set(inOrg(dona)).send({ priceCents: 20_000 }).expect(200);
  });

  it('sessão do pacote: valor zero, desconta o saldo, comissão pelo valor da sessão, reserva em comandas abertas', async () => {
    const cpId = (await http.get(`/v1/org/client-packages?clientId=${ana}&ativos=1`).set(inOrg(rita)).expect(200)).body[0].id;
    const balanceBefore = async () => ((await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body as { memberName: string; commissionsCents: number }[]).find((b) => b.memberName === 'Paula Pro')?.commissionsCents ?? 0;
    const commBefore = await balanceBefore();

    const used = await order(ana);
    const added = await addItem(used, { kind: 'SESSAO_PACOTE', refId: cpId, memberId: memberId('Paula Pro') }).expect(201);
    expect(added.body.items[0]).toMatchObject({ kind: 'SESSAO_PACOTE', unitPriceCents: 0, netCents: 0, description: 'Sessão: 5 cortes', serviceId: corte.id });
    expect(added.body.totals).toMatchObject({ totalCents: 0, dueCents: 0 });
    await close(used).expect(200);
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ sessionsUsed: 1, sessionsLeft: 4 });
    // Comissão: 40% de (200,00 ÷ 5 = 40,00) = 16,00.
    expect((await balanceBefore()) - commBefore).toBe(1600);

    // Reserva: 4 sobraram; abertas 3 + 2 não cabem.
    const a = await order(ana);
    await addItem(a, { kind: 'SESSAO_PACOTE', refId: cpId, quantity: 3 }).expect(201);
    const b = await order(ana);
    const over = await addItem(b, { kind: 'SESSAO_PACOTE', refId: cpId, quantity: 2 }).expect(400);
    expect(over.body.message).toMatch(/já estão em comandas abertas/);
    await addItem(b, { kind: 'SESSAO_PACOTE', refId: cpId, quantity: 1 }).expect(201);
    await addItem(b, { kind: 'SESSAO_PACOTE', refId: cpId, discountCents: 100 }).expect(400);
    await cancel(a).expect(200);
    await cancel(b).expect(200);

    // Estorno da sessão devolve o saldo e a comissão.
    await cancel(used).expect(200);
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ sessionsUsed: 0, sessionsLeft: 5 });
    expect(await balanceBefore()).toBe(commBefore);
  });

  it('pacote vencido ou já usado: não vende sessão, não estorna a venda', async () => {
    const cpId = (await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0].id;
    // Usa uma sessão: a venda do pacote não pode mais ser estornada.
    const s = await order(ana);
    await addItem(s, { kind: 'SESSAO_PACOTE', refId: cpId }).expect(201);
    await close(s).expect(200);
    const sale = (await http.get('/v1/org/orders?status=FECHADA').set(inOrg(rita)).expect(200)).body.find((o: { clientName: string; totalCents: number }) => o.clientName === 'Ana Pacote' && o.totalCents === 20_000);
    const refused = await cancel(sale.id).expect(400);
    expect(refused.body.message).toMatch(/já foi usado/);

    await db.query(`UPDATE skedulei_client_packages SET expires_at = $1 WHERE id = $2`, [addDays(TODAY, -1), cpId]);
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0].status).toBe('EXPIRADO');
    const late = await addItem(await order(ana), { kind: 'SESSAO_PACOTE', refId: cpId }).expect(400);
    expect(late.body.message).toMatch(/não está mais ativo/);
    // Esgotado também.
    await db.query(`UPDATE skedulei_client_packages SET expires_at = NULL, sessions_used = sessions_total WHERE id = $1`, [cpId]);
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ status: 'ESGOTADO', sessionsLeft: 0 });
    expect((await http.get(`/v1/org/client-packages?clientId=${ana}&ativos=1`).set(inOrg(rita)).expect(200)).body).toEqual([]);
  });

  // ------------------------------------------------------------------ clube

  let clubId = '';
  it('clube: mensalidade pela comanda, ciclo, limite por mês e uso', async () => {
    clubId = (await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube Corte', priceCents: 9900, sessionsPerMonth: 2 }).expect(201)).body.id;
    const bia = await newClient('Bia Clube');
    await sell(bia, { kind: 'CLUBE', refId: clubId }, 9900);
    const [m] = (await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body;
    expect(m).toMatchObject({ planName: 'Clube Corte', state: 'EM_DIA', status: 'ATIVA', paidThrough: cycleEnd(TODAY, 1), sessionsUsedInCycle: 0, canUse: true, sessionsPerMonth: 2 });

    const dup = await addItem(await order(bia), { kind: 'CLUBE', refId: clubId }).expect(400);
    expect(dup.body.message).toMatch(/em dia até/);

    await sell(bia, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id, memberId: memberId('Paula Pro') }, 0);
    await sell(bia, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id }, 0);
    const third = await addItem(await order(bia), { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id }).expect(400);
    expect(third.body.message).toMatch(/permite 2 sessão/);
    expect((await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ sessionsUsedInCycle: 2, canUse: false });

    // Pausada não usa; reativar volta.
    await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(paula)).send({ status: 'PAUSADA' }).expect(403);
    await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'PAUSADA' }).expect(200);
    expect((await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body[0].state).toBe('PAUSADA');
    await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'ATIVA' }).expect(200);
  });

  it('clube vencido: bloqueia o uso, renova recomeçando o ciclo e a renovação não estorna sozinha', async () => {
    const bia = ((await http.get('/v1/org/clients?q=Bia').set(inOrg(rita)).expect(200)).body as { id: string }[])[0].id;
    const m = (await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body[0];
    await db.query(`UPDATE skedulei_client_memberships SET paid_through = $1 WHERE id = $2`, [addDays(TODAY, -1), m.id]);
    await db.query(`UPDATE skedulei_membership_uses SET used_date = used_date - 60 WHERE membership_id = $1`, [m.id]);
    expect((await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ state: 'VENCIDA', canUse: false });
    const blocked = await addItem(await order(bia), { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id }).expect(400);
    expect(blocked.body.message).toMatch(/vencida/);

    const renewal = await sell(bia, { kind: 'CLUBE', refId: clubId }, 9900);
    expect((await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ state: 'EM_DIA', paidThrough: cycleEnd(TODAY, 1), sessionsUsedInCycle: 0, canUse: true });
    expect(renewal).toBeTruthy();
  });

  it('estorno da mensalidade: remove a assinatura criada ou volta um ciclo', async () => {
    const caio = await newClient('Caio Clube');
    const first = await sell(caio, { kind: 'CLUBE', refId: clubId }, 9900);
    // Estorno da venda original: a assinatura some.
    await cancel(first).expect(200);
    expect((await http.get(`/v1/org/memberships?clientId=${caio}`).set(inOrg(rita)).expect(200)).body).toEqual([]);

    await sell(caio, { kind: 'CLUBE', refId: clubId }, 9900);
    const mid = (await http.get(`/v1/org/memberships?clientId=${caio}`).set(inOrg(rita)).expect(200)).body[0].id;
    // Perto de vencer (5 dias), renovar acrescenta um ciclo; estornar volta ao ciclo anterior.
    await db.query(`UPDATE skedulei_client_memberships SET paid_through = $1 WHERE id = $2`, [addDays(TODAY, 5), mid]);
    const renew = await sell(caio, { kind: 'CLUBE', refId: clubId }, 9900);
    expect((await http.get(`/v1/org/memberships?clientId=${caio}`).set(inOrg(rita)).expect(200)).body[0].paidThrough).toBe(cycleEnd(TODAY, 2));
    await cancel(renew).expect(200);
    expect((await http.get(`/v1/org/memberships?clientId=${caio}`).set(inOrg(rita)).expect(200)).body[0].paidThrough).toBe(cycleEnd(TODAY, 1));
  });

  // ------------------------------------------------------------------ vale-presente

  it('vale-presente: venda não é receita, código com saldo, pagamento parcial, estorno protegido', async () => {
    const summary = async () => (await http.get(`/v1/org/finance/summary?from=${TODAY}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body as { revenueCents: number; orders: number };
    const before = await summary();
    const dani = await newClient('Dani Vale');
    await addItem(await order(dani), { kind: 'VALE', unitPriceCents: 0 }).expect(400);
    const sale = await sell(dani, { kind: 'VALE', unitPriceCents: 10_000 }, 10_000);
    const after = await summary();
    expect(after.revenueCents).toBe(before.revenueCents);

    const [card] = (await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body;
    expect(card).toMatchObject({ initialCents: 10_000, balanceCents: 10_000, status: 'ATIVO', buyerName: 'Dani Vale' });
    expect(card.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(card.expiresAt).toBe(addDays(TODAY, 365));
    const typed = card.code.toLowerCase().replace(/-/g, ' ');
    expect((await http.get(`/v1/org/gift-cards/lookup?code=${encodeURIComponent(typed)}`).set(inOrg(rita)).expect(200)).body.id).toBe(card.id);
    await http.get('/v1/org/gift-cards/lookup?code=abc').set(inOrg(rita)).expect(400);
    await http.get('/v1/org/gift-cards/lookup?code=ZZZZ-ZZZZ-ZZZZ').set(inOrg(rita)).expect(404);

    // Pagar um corte de R$ 80: R$ 60 no vale + R$ 20 no PIX.
    const use = await order(dani);
    await addItem(use, { kind: 'SERVICO', serviceId: corte.id, memberId: memberId('Paula Pro') }).expect(201);
    await pay(use, { method: 'VALE_PRESENTE', amountCents: 6000 }).expect(400); // sem código
    await pay(use, { method: 'VALE_PRESENTE', amountCents: 6000, giftCode: 'ZZZZ-ZZZZ-ZZZZ' }).expect(404);
    await pay(use, { method: 'VALE_PRESENTE', amountCents: 7000, giftCode: typed }).expect(201);
    const removed = await http.delete(`/v1/org/orders/${use}/payments/${(await http.get(`/v1/org/orders/${use}`).set(inOrg(rita)).expect(200)).body.payments[0].id}`).set(inOrg(rita)).expect(200);
    expect(removed.body.payments).toEqual([]);
    expect((await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body[0].balanceCents).toBe(10_000);

    await pay(use, { method: 'VALE_PRESENTE', amountCents: 6000, giftCode: typed }).expect(201);
    await pay(use, { method: 'PIX', amountCents: 2000 }).expect(201);
    await close(use).expect(200);
    expect((await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body[0]).toMatchObject({ balanceCents: 4000, status: 'ATIVO' });
    const cash = (await http.get('/v1/org/cash/current').set(inOrg(rita)).expect(200)).body;
    expect(cash.expected.byMethod.VALE_PRESENTE).toBe(6000);
    // Vale usado como pagamento é consumo: entra na receita.
    expect((await summary()).revenueCents).toBe(before.revenueCents + 8000);

    // Saldo insuficiente.
    const over = await order(dani);
    await addItem(over, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    expect((await pay(over, { method: 'VALE_PRESENTE', amountCents: 5000, giftCode: card.code }).expect(400)).body.message).toMatch(/saldo/);
    await cancel(over).expect(200);

    // Não estorna a venda do vale depois de usado; estornar o uso devolve o saldo e libera o estorno da venda.
    expect((await cancel(sale).expect(400)).body.message).toMatch(/já foi usado/);
    await cancel(use).expect(200);
    expect((await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body[0].balanceCents).toBe(10_000);
    await cancel(sale).expect(200);
    await http.get(`/v1/org/gift-cards/lookup?code=${card.code}`).set(inOrg(rita)).expect(404);
  });

  it('vale vencido não paga', async () => {
    const id = await sell(undefined, { kind: 'VALE', unitPriceCents: 5000 }, 5000);
    expect(id).toBeTruthy();
    const [card] = (await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body;
    await db.query(`UPDATE skedulei_gift_cards SET expires_at = $1 WHERE id = $2`, [addDays(TODAY, -1), card.id]);
    expect((await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body[0].status).toBe('EXPIRADO');
    const o = await order();
    await addItem(o, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    expect((await pay(o, { method: 'VALE_PRESENTE', amountCents: 1000, giftCode: card.code }).expect(400)).body.message).toMatch(/vencido/);
    await cancel(o).expect(200);
  });

  // ------------------------------------------------------------------ fidelidade

  let evaId = '';
  let firstClosed = '';
  it('pontos: regra validada, ganho no fechamento, resgate vira desconto e estorno desfaz', async () => {
    await http.patch('/v1/org').set(inOrg(dona)).send({ loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 0 } }).expect(400);
    const cfg = await http.patch('/v1/org').set(inOrg(dona)).send({ loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 } }).expect(200);
    expect(cfg.body.loyalty).toEqual({ enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 });

    evaId = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Eva Cliente', phone: '11955550001' }).expect(201)).body.id;
    firstClosed = await order(evaId);
    await addItem(firstClosed, { kind: 'SERVICO', serviceId: corte.id, quantity: 2, memberId: memberId('Paula Pro') }).expect(201);
    await pay(firstClosed, { method: 'PIX', amountCents: 16_000 }).expect(201);
    await close(firstClosed).expect(200);
    let bal = (await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body;
    expect(bal).toMatchObject({ enabled: true, balance: 160 });
    expect(bal.entries[0]).toMatchObject({ points: 160, reason: 'Compra', orderNumber: expect.any(Number) });

    const o2 = await order(evaId);
    await addItem(o2, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    await http.post(`/v1/org/orders/${o2}/redeem`).set(inOrg(rita)).send({ points: 150 }).expect(400); // não é múltiplo
    expect((await http.post(`/v1/org/orders/${o2}/redeem`).set(inOrg(rita)).send({ points: 200 }).expect(400)).body.message).toMatch(/até 100 pontos/);
    const redeemed = await http.post(`/v1/org/orders/${o2}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(200);
    expect(redeemed.body.loyalty).toEqual({ redeemedPoints: 100, discountCents: 1000 });
    expect(redeemed.body.totals).toMatchObject({ subtotalCents: 8000, discountCents: 1000, totalCents: 7000 });
    expect((await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body.balance).toBe(60);
    // Remover o item reduz o resgate ao que cabe.
    await http.post(`/v1/org/orders/${o2}/redeem`).set(inOrg(rita)).send({ points: 0 }).expect(200);
    expect((await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body.balance).toBe(160);
    await http.post(`/v1/org/orders/${o2}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(200);

    await pay(o2, { method: 'PIX', amountCents: 7000 }).expect(201);
    await close(o2).expect(200);
    bal = (await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body;
    expect(bal.balance).toBe(160 - 100 + 70);
    // O desconto dos pontos não é receita extra: o faturamento da comanda é o que foi pago.
    await cancel(o2).expect(200);
    expect((await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body.balance).toBe(160);
  });

  it('pontos: sem cliente não resgata; ajuste manual não deixa negativo; desligado não pontua', async () => {
    const semCliente = await order();
    await addItem(semCliente, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    await http.post(`/v1/org/orders/${semCliente}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(400);
    await cancel(semCliente).expect(200);

    await http.post(`/v1/org/loyalty/${evaId}/adjust`).set(inOrg(paula)).send({ points: 10, note: 'x' }).expect(403);
    expect((await http.post(`/v1/org/loyalty/${evaId}/adjust`).set(inOrg(dona)).send({ points: 40, note: 'Cortesia' }).expect(201)).body.balance).toBe(200);
    await http.post(`/v1/org/loyalty/${evaId}/adjust`).set(inOrg(dona)).send({ points: -500, note: 'Erro' }).expect(400);

    await http.patch('/v1/org').set(inOrg(dona)).send({ loyalty: { enabled: false, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 } }).expect(200);
    expect((await http.get(`/v1/org/loyalty/${evaId}`).set(inOrg(rita)).expect(200)).body).toMatchObject({ enabled: false, balance: 0 });
    const off = await order(evaId);
    await addItem(off, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    expect((await http.post(`/v1/org/orders/${off}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(400)).body.message).toMatch(/desligado/);
    await cancel(off).expect(200);
  });

  // ------------------------------------------------------------------ avaliações

  let reviewToken = '';
  it('avaliação: link único, pública sem login, uma resposta só, nome abreviado', async () => {
    const open = await order(evaId);
    await addItem(open, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
    await http.post(`/v1/org/orders/${open}/review-request`).set(inOrg(rita)).expect(400); // comanda aberta
    await cancel(open).expect(200);
    const noClient = await sell(undefined, { kind: 'SERVICO', serviceId: corte.id }, 8000);
    await http.post(`/v1/org/orders/${noClient}/review-request`).set(inOrg(rita)).expect(400);

    const req = (await http.post(`/v1/org/orders/${firstClosed}/review-request`).set(inOrg(rita)).expect(201)).body;
    reviewToken = req.token;
    expect(req.path).toBe(`/avaliar/${reviewToken}`);
    expect(req.message).toContain(`/avaliar/${reviewToken}`);
    expect(req.message).toMatch(/^Oi, Eva!/);

    const info = (await http.get(`/v1/public/reviews/${reviewToken}`).expect(200)).body;
    expect(info).toEqual({ organizationName: 'Salão Retenção', professionalName: 'Paula Pro', serviceName: 'Corte', answered: false });
    await http.get('/v1/public/reviews/token-errado').expect(404);
    await http.post(`/v1/public/reviews/${reviewToken}`).send({ rating: 6 }).expect(400);
    await http.post(`/v1/public/reviews/${reviewToken}`).send({ rating: 0 }).expect(400);
    await http.post(`/v1/public/reviews/${reviewToken}`).send({ rating: 5, comment: 'Amei o atendimento!' }).expect(201);
    expect((await http.post(`/v1/public/reviews/${reviewToken}`).send({ rating: 1 }).expect(409)).body.message).toMatch(/já enviou/);
    expect((await http.get(`/v1/public/reviews/${reviewToken}`).expect(200)).body.answered).toBe(true);
    await http.post(`/v1/org/orders/${firstClosed}/review-request`).set(inOrg(rita)).expect(409);
  });

  it('avaliações aparecem para a equipe e na página pública; ocultar tira da página', async () => {
    const list = (await http.get('/v1/org/reviews').set(inOrg(rita)).expect(200)).body;
    expect(list.summary).toEqual({ count: 1, averageTimes10: 50 });
    expect(list.items[0]).toMatchObject({ rating: 5, comment: 'Amei o atendimento!', clientName: 'Eva C.', memberName: 'Paula Pro', serviceName: 'Corte', published: true });
    const page = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(page.rating).toEqual({ count: 1, averageTimes10: 50 });
    expect(page.reviews).toEqual([expect.objectContaining({ rating: 5, comment: 'Amei o atendimento!', authorName: 'Eva C.' })]);
    expect(JSON.stringify(page)).not.toContain('Eva Cliente');

    await http.patch(`/v1/org/reviews/${list.items[0].id}`).set(inOrg(paula)).send({ published: false }).expect(403);
    await http.patch(`/v1/org/reviews/${list.items[0].id}`).set(inOrg(dona)).send({ published: false }).expect(200);
    const hidden = (await http.get(`/v1/public/orgs/${slug}`).expect(200)).body;
    expect(hidden.rating.count).toBe(0);
    expect(hidden.reviews).toEqual([]);
    await http.patch(`/v1/org/reviews/${list.items[0].id}`).set(inOrg(dona)).send({ published: true }).expect(200);

    // LGPD: apagar a cliente tira o nome da avaliação (a nota fica).
    await http.delete(`/v1/org/clients/${evaId}`).set(inOrg(dona)).expect(204);
    const anon = (await http.get('/v1/org/reviews').set(inOrg(dona)).expect(200)).body.items[0];
    expect(anon).toMatchObject({ rating: 5, clientName: '' });
  });

  // ------------------------------------------------------------------ painel de TV

  it('painel de TV: nomes abreviados, chamada em destaque e permissões', async () => {
    const lia = await newClient('Lia Painel Souza');
    const soon = new Date(Date.now() + 5 * 60_000).toISOString();
    const appt = (
      await http
        .post('/v1/org/appointments')
        .set(inOrg(dona))
        .send({ memberId: memberId('Paula Pro'), serviceId: corte.id, clientId: lia, startsAt: soon, allowOutsideHours: true })
        .expect(201)
    ).body;
    expect(appt.calledAt).toBeNull();

    let board = (await http.get('/v1/org/tv').set(inOrg(rita)).expect(200)).body;
    expect(board.organizationName).toBe('Salão Retenção');
    expect(board.next.map((e: { name: string }) => e.name)).toContain('Lia S.');
    expect(JSON.stringify(board)).not.toContain('Painel');
    expect(board.calling).toEqual([]);

    await http.get('/v1/org/tv').set(inOrg(paula)).expect(403);
    await http.post(`/v1/org/appointments/${appt.id}/call`).set(inOrg(paula)).expect(200); // é dela
    const called = await http.post(`/v1/org/appointments/${appt.id}/call`).set(inOrg(rita)).expect(200);
    expect(called.body.calledAt).toBeTruthy();
    board = (await http.get('/v1/org/tv').set(inOrg(rita)).expect(200)).body;
    expect(board.calling.map((e: { name: string }) => e.name)).toEqual(['Lia S.']);
    expect(board.next.map((e: { name: string }) => e.name)).not.toContain('Lia S.');

    // Chamada vencida (> 2 min) sai do destaque; quem chegou aparece em "aguardando".
    await db.query(`UPDATE skedulei_appointments SET called_at = NOW() - INTERVAL '5 minutes' WHERE id = $1`, [appt.id]);
    await http.post('/v1/org/orders').set(inOrg(rita)).send({ appointmentIds: [appt.id] }).expect(201);
    board = (await http.get('/v1/org/tv').set(inOrg(rita)).expect(200)).body;
    expect(board.calling).toEqual([]);
    expect(board.waiting.map((e: { name: string }) => e.name)).toEqual(['Lia S.']);

    await http.patch(`/v1/org/appointments/${appt.id}`).set(inOrg(rita)).send({ status: 'EM_ATENDIMENTO' }).expect(200);
    board = (await http.get('/v1/org/tv').set(inOrg(rita)).expect(200)).body;
    expect(board.inService.map((e: { name: string }) => e.name)).toEqual(['Lia S.']);
    await http.post(`/v1/org/appointments/${appt.id}/call`).set(inOrg(rita)).expect(400);
  });

  // ------------------------------------------------------------------ isolamento

  it('outro negócio não vê vales, pacotes, estoque nem avaliações', async () => {
    const outra = await registerUser(http, 'Outra Retenção', 'outra-ret@skedulei.test');
    const other = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Salão Ret')).expect(201)).body;
    await http
      .patch('/v1/org')
      .set(inOrg(outra, other.id))
      .send({ features: ['ESTOQUE', 'PACOTES', 'ASSINATURAS', 'VALES', 'FIDELIDADE'] })
      .expect(200);
    const mine = (await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body as { code: string }[];
    const code = mine[0]?.code ?? 'ZZZZ-ZZZZ-ZZZZ';
    await http.get(`/v1/org/gift-cards/lookup?code=${code}`).set(inOrg(outra, other.id)).expect(404);
    for (const path of ['/v1/org/gift-cards', '/v1/org/package-plans', '/v1/org/membership-plans', '/v1/org/stock/products', '/v1/org/client-packages', '/v1/org/memberships']) {
      expect((await http.get(path).set(inOrg(outra, other.id)).expect(200)).body).toEqual([]);
    }
    expect((await http.get('/v1/org/reviews').set(inOrg(outra, other.id)).expect(200)).body.items).toEqual([]);
    // Usar plano/produto de outro negócio numa comanda é recusado.
    const orderOther = (await http.post('/v1/org/orders').set(inOrg(outra, other.id)).send({}).expect(201)).body.id;
    const pomadaId = (await product('Pomada')).id;
    await http.post(`/v1/org/orders/${orderOther}/items`).set(inOrg(outra, other.id)).send({ kind: 'PRODUTO', refId: pomadaId }).expect(404);
    await http.post(`/v1/org/orders/${orderOther}/review-request`).set(inOrg(dona)).expect(404);
  });
});
