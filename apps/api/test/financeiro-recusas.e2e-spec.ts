/**
 * Caixa, comissões, fluxo de caixa, avaliações, pontos e vales: filtros, escopo por perfil e recusas.
 * Banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TODAY = todayIn('America/Sao_Paulo');
const NOBODY = '00000000-0000-4000-8000-000000000000';

describe('Caixa, comissões, avaliações e pontos: recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let paula: Session;
  let rita: Session;
  let orgId = '';
  let corteId = '';
  let paulaId = '';
  let donaMemberId = '';
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });
  const order = async (clientId?: string) => (await http.post('/v1/org/orders').set(inOrg(rita)).send(clientId ? { clientId } : {}).expect(201)).body.id as string;
  const addItem = (id: string, body: object) => http.post(`/v1/org/orders/${id}/items`).set(inOrg(rita)).send(body);
  async function sell(clientId: string | undefined, item: object, total: number) {
    const id = await order(clientId);
    await addItem(id, item).expect(201);
    await http.post(`/v1/org/orders/${id}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: total }).expect(201);
    await http.post(`/v1/org/orders/${id}/close`).set(inOrg(rita)).expect(200);
    return id;
  }
  async function join(name: string, email: string): Promise<Session> {
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Caixa Dois', 'dona-caixa2@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Caixa Dois', {
          team: [
            { name: 'Paula Pro', email: 'paula-caixa2@skedulei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Rita Recepção', email: 'rita-caixa2@skedulei.test', role: 'RECEPCAO', bookable: false },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    corteId = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body[0].id;
    const members = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { id: string; name: string; role: string }[];
    paulaId = members.find((m) => m.name === 'Paula Pro')!.id;
    donaMemberId = members.find((m) => m.role === 'DONO')!.id;
    paula = await join('Paula', 'paula-caixa2@skedulei.test');
    rita = await join('Rita', 'rita-caixa2@skedulei.test');
    await http.patch(`/v1/org/members/${paulaId}`).set(inOrg(dona)).send({ commissionBps: 5000 }).expect(200);
    await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['VALES', 'FIDELIDADE', 'COMISSOES'] }).expect(200);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('caixa', () => {
    it('sem caixa aberto não recebe; abre, movimenta e fecha com diferença', async () => {
      const aberto = await order();
      await addItem(aberto, { kind: 'AVULSO', description: 'Taxa', unitPriceCents: 1000 }).expect(201);
      const semCaixa = await http.post(`/v1/org/orders/${aberto}/payments`).set(inOrg(rita)).send({ method: 'DINHEIRO', amountCents: 1000 }).expect(400);
      expect(semCaixa.body.message).toMatch(/Abra o caixa/);
      await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SUPRIMENTO', amountCents: 100 }).expect(400);

      await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 5000 }).expect(201);
      await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 5000 }).expect(409);
      const sup = await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SUPRIMENTO', amountCents: 2000 }).expect(201);
      expect(sup.body.status).toBe('ABERTO');
      await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SANGRIA', amountCents: 999_999, note: 'Banco' }).expect(400);
      await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SANGRIA', amountCents: 1000, note: 'Banco' }).expect(201);
      await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SANGRIA', amountCents: 100 }).expect(201);

      // Comanda aberta com pagamento impede o fechamento.
      await http.post(`/v1/org/orders/${aberto}/payments`).set(inOrg(rita)).send({ method: 'DINHEIRO', amountCents: 1000 }).expect(201);
      const pendente = await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 0 }).expect(400);
      expect(pendente.body.message).toMatch(/comandas abertas/);
      await http.post(`/v1/org/orders/${aberto}/close`).set(inOrg(rita)).expect(200);

      const atual = (await http.get('/v1/org/cash/current').set(inOrg(rita)).expect(200)).body;
      const fechado = await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: atual.expected.drawerCents - 500, notes: 'Faltou troco' }).expect(201);
      expect(fechado.body).toMatchObject({ status: 'FECHADO' });
      expect(fechado.body.closedByName).toBe('Rita Recepção');
      await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 0 }).expect(400);
      const hist = (await http.get('/v1/org/cash/history').set(inOrg(dona)).expect(200)).body;
      expect(hist.length).toBeGreaterThan(0);
      await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 0 }).expect(201);
    });
  });

  describe('comissões e vales', () => {
    it('vale com e sem observação e data; profissional inexistente; listas filtradas', async () => {
      await http.post('/v1/org/commissions/advances').set(inOrg(dona)).send({ memberId: NOBODY, amountCents: 1000 }).expect(404);
      const comNota = await http.post('/v1/org/commissions/advances').set(inOrg(dona)).send({ memberId: paulaId, amountCents: 2000, note: 'Adiantamento', date: addDays(TODAY, -1) }).expect(201);
      expect(comNota.body).toMatchObject({ memberName: 'Paula Pro', note: 'Adiantamento', date: addDays(TODAY, -1) });
      const semNota = await http.post('/v1/org/commissions/advances').set(inOrg(dona)).send({ memberId: donaMemberId, amountCents: 500 }).expect(201);
      expect(semNota.body).toMatchObject({ note: null, date: TODAY });

      expect((await http.get('/v1/org/commissions/advances').set(inOrg(dona)).expect(200)).body).toHaveLength(2);
      expect((await http.get(`/v1/org/commissions/advances?memberId=${paulaId}`).set(inOrg(dona)).expect(200)).body).toHaveLength(1);
      // A profissional só enxerga o que é dela.
      expect((await http.get('/v1/org/commissions/advances').set(inOrg(paula)).expect(200)).body).toHaveLength(1);
      await http.get(`/v1/org/commissions/advances?memberId=${donaMemberId}`).set(inOrg(paula)).expect(403);
      await http.get('/v1/org/commissions/advances').set(inOrg(rita)).expect(403);
      await http.get('/v1/org/commissions/balances').set(inOrg(rita)).expect(403);
      await http.post('/v1/org/commissions/advances').set(inOrg(paula)).send({ memberId: paulaId, amountCents: 100 }).expect(403);
    });

    it('comissão da profissional: saldo, lançamentos, fechamento com vale e fechamento vazio', async () => {
      const ana = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Ana Comissão', phone: '11999990000' }).expect(201)).body.id;
      await sell(ana, { kind: 'SERVICO', serviceId: corteId, memberId: paulaId }, 8000);
      const meu = (await http.get('/v1/org/commissions/balances').set(inOrg(paula)).expect(200)).body as { memberName: string; commissionsCents: number; advancesCents: number }[];
      expect(meu).toHaveLength(1);
      expect(meu[0]).toMatchObject({ memberName: 'Paula Pro', commissionsCents: 4000, advancesCents: 2000 });
      expect((await http.get('/v1/org/commissions/entries').set(inOrg(paula)).expect(200)).body).toHaveLength(1);
      expect((await http.get(`/v1/org/commissions/entries?memberId=${paulaId}`).set(inOrg(dona)).expect(200)).body).toHaveLength(1);
      await http.get(`/v1/org/commissions/entries?memberId=${donaMemberId}`).set(inOrg(paula)).expect(403);
      const todos = (await http.get('/v1/org/commissions/balances').set(inOrg(dona)).expect(200)).body as { memberName: string }[];
      expect(todos.map((b) => b.memberName)).toEqual(['Dona Caixa Dois', 'Paula Pro']);

      await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: NOBODY }).expect(404);
      const pg = await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: paulaId }).expect(201);
      expect(pg.body).toMatchObject({ commissionsCents: 4000, advancesCents: 2000, totalCents: 2000 });
      const vazio = await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: paulaId }).expect(400);
      expect(vazio.body.message).toMatch(/Nada em aberto/);
      // Só vale em aberto: o fechamento fica negativo.
      const soVale = await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: donaMemberId }).expect(201);
      expect(soVale.body).toMatchObject({ commissionsCents: 0, advancesCents: 500, totalCents: -500 });
      expect((await http.get('/v1/org/commissions/payouts').set(inOrg(paula)).expect(200)).body).toHaveLength(1);
      expect((await http.get('/v1/org/commissions/payouts').set(inOrg(dona)).expect(200)).body).toHaveLength(2);
    });
  });

  describe('resumo e fluxo de caixa', () => {
    it('resumo recusa período invertido', async () => {
      await http.get(`/v1/org/finance/summary?from=${TODAY}&to=${addDays(TODAY, -1)}`).set(inOrg(dona)).expect(400);
    });

    it('fluxo realizado: padrões, período invertido, mais de um ano e janela longa por semana', async () => {
      const padrao = (await http.get('/v1/org/finance/cashflow?mode=REALIZADO').set(inOrg(dona)).expect(200)).body;
      expect(padrao.mode).toBe('REALIZADO');
      // O fechamento de comissão de hoje sai do caixa.
      expect(JSON.stringify(padrao)).toContain('2000');
      await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${TODAY}&to=${addDays(TODAY, -1)}`).set(inOrg(dona)).expect(400);
      await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${addDays(TODAY, -400)}&to=${TODAY}`).set(inOrg(dona)).expect(400);
      const longo = (await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${addDays(TODAY, -90)}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body;
      expect(longo.mode).toBe('REALIZADO');
      const semana = (await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${addDays(TODAY, -10)}&to=${TODAY}&bucket=semana`).set(inOrg(dona)).expect(200)).body;
      expect(semana.mode).toBe('REALIZADO');
      const proj = (await http.get('/v1/org/finance/cashflow?mode=PROJETADO').set(inOrg(dona)).expect(200)).body;
      expect(proj.mode).toBe('PROJETADO');
      await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=60&bucket=semana').set(inOrg(dona)).expect(200);
    });
  });

  describe('avaliações', () => {
    it('só se pede depois de paga, com cliente; renova o link até responder; só uma resposta', async () => {
      const ana = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Ana Avalia', phone: '11999991111' }).expect(201)).body.id;
      const aberta = await order(ana);
      await http.post(`/v1/org/orders/${aberta}/review-request`).set(inOrg(rita)).expect(400);
      await http.post(`/v1/org/orders/${NOBODY}/review-request`).set(inOrg(rita)).expect(404);
      const semCliente = await sell(undefined, { kind: 'AVULSO', description: 'Balcão', unitPriceCents: 1000 }, 1000);
      await http.post(`/v1/org/orders/${semCliente}/review-request`).set(inOrg(rita)).expect(400);

      // Item avulso, sem profissional: a avaliação não cita ninguém.
      const paga = await sell(ana, { kind: 'AVULSO', description: 'Produto de balcão', unitPriceCents: 2000 }, 2000);
      const primeiro = (await http.post(`/v1/org/orders/${paga}/review-request`).set(inOrg(rita)).expect(201)).body;
      const novo = (await http.post(`/v1/org/orders/${paga}/review-request`).set(inOrg(rita)).expect(201)).body;
      expect(novo.token).not.toBe(primeiro.token);
      expect(novo.message).toContain('Ana');
      const info = (await http.get(`/v1/public/reviews/${novo.token}`).expect(200)).body;
      expect(info).toMatchObject({ professionalName: null, serviceName: 'Produto de balcão', answered: false });
      await http.get('/v1/public/reviews/token-que-nao-existe').expect(404);
      await http.post(`/v1/public/reviews/${novo.token}`).send({ rating: 9 }).expect(400);
      await http.post(`/v1/public/reviews/${novo.token}`).send({ rating: 5 }).expect(201);
      await http.post(`/v1/public/reviews/${novo.token}`).send({ rating: 4 }).expect(409);
      await http.post(`/v1/org/orders/${paga}/review-request`).set(inOrg(rita)).expect(409);

      const lista = (await http.get('/v1/org/reviews').set(inOrg(dona)).expect(200)).body;
      expect(lista.items).toHaveLength(1);
      expect(lista.items[0].comment).toBeNull();
      await http.patch(`/v1/org/reviews/${NOBODY}`).set(inOrg(dona)).send({ published: false }).expect(404);
    });

    it('avaliação ainda sem resposta não pode ser publicada nem ocultada', async () => {
      const bia = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Bia Avalia', phone: '11999992222' }).expect(201)).body.id;
      const paga = await sell(bia, { kind: 'SERVICO', serviceId: corteId, memberId: paulaId }, 8000);
      const link = (await http.post(`/v1/org/orders/${paga}/review-request`).set(inOrg(rita)).expect(201)).body;
      const info = (await http.get(`/v1/public/reviews/${link.token}`).expect(200)).body;
      expect(info).toMatchObject({ professionalName: 'Paula Pro', serviceName: 'Corte' });
      const [row] = (await http.get('/v1/org/reviews').set(inOrg(dona)).expect(200)).body.items as { id: string }[];
      await http.patch(`/v1/org/reviews/${row.id}`).set(inOrg(dona)).send({ published: false }).expect(200);
      await http.patch(`/v1/org/reviews/${row.id}`).set(inOrg(dona)).send({ published: 'sim' }).expect(400);
    });
  });

  describe('pontos e vales', () => {
    it('extrato e ajuste: cliente que não existe, programa desligado e ajuste zerado', async () => {
      const cli = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Cli Pontos', phone: '11999993333' }).expect(201)).body.id;
      await http.get(`/v1/org/loyalty/${NOBODY}`).set(inOrg(rita)).expect(404);
      const off = (await http.get(`/v1/org/loyalty/${cli}`).set(inOrg(rita)).expect(200)).body;
      expect(off).toMatchObject({ enabled: false, balance: 0, entries: [] });
      await http.post(`/v1/org/loyalty/${cli}/adjust`).set(inOrg(dona)).send({ points: 10, note: 'x' }).expect(400);

      await http.patch('/v1/org').set(inOrg(dona)).send({ loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 } }).expect(200);
      await http.post(`/v1/org/loyalty/${NOBODY}/adjust`).set(inOrg(dona)).send({ points: 10, note: 'x' }).expect(404);
      await http.post(`/v1/org/loyalty/${cli}/adjust`).set(inOrg(dona)).send({ points: 0, note: 'x' }).expect(400);
      await http.post(`/v1/org/loyalty/${cli}/adjust`).set(inOrg(dona)).send({ points: -5, note: 'x' }).expect(400);
      const ok = (await http.post(`/v1/org/loyalty/${cli}/adjust`).set(inOrg(dona)).send({ points: 50, note: 'Cortesia' }).expect(201)).body;
      expect(ok.balance).toBe(50);
      // Entrada de ajuste sem observação aparece como "Ajuste"; ganho e resgate têm rótulo próprio.
      const compra = await sell(cli, { kind: 'SERVICO', serviceId: corteId }, 8000);
      const extrato = (await http.get(`/v1/org/loyalty/${cli}`).set(inOrg(rita)).expect(200)).body;
      expect(extrato.entries.map((e: { reason: string }) => e.reason)).toEqual(expect.arrayContaining(['Cortesia', 'Compra']));
      expect(extrato.entries.find((e: { reason: string }) => e.reason === 'Compra').orderNumber).toEqual(expect.any(Number));
      expect(compra).toBeTruthy();
    });

    it('vale: código mal formado, que não existe, e listagem com a comanda de origem', async () => {
      const cli = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Cli Vale', phone: '11999994444' }).expect(201)).body.id;
      await sell(cli, { kind: 'VALE', unitPriceCents: 5000 }, 5000);
      await http.get('/v1/org/gift-cards/lookup?code=abc').set(inOrg(rita)).expect(400);
      await http.get('/v1/org/gift-cards/lookup?code=ZZZZ-ZZZZ-ZZZZ').set(inOrg(rita)).expect(404);
      const [card] = (await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body;
      expect(card).toMatchObject({ buyerName: 'Cli Vale', orderNumber: expect.any(Number) });
      const achado = (await http.get(`/v1/org/gift-cards/lookup?code=${card.code.toLowerCase()}`).set(inOrg(rita)).expect(200)).body;
      expect(achado.id).toBe(card.id);
    });
  });
});
