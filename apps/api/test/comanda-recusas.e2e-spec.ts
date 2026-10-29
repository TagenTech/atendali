/**
 * Comanda, estoque e fidelidade: os caminhos de recusa (item sem cliente, saldo que não cobre, plano
 * pausado, vale vencido...) e as edições que o fluxo feliz não visita. Banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ORG_HEADER, todayIn } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TODAY = todayIn('America/Sao_Paulo');
const NOBODY = '00000000-0000-4000-8000-000000000000';

describe('Comanda, estoque e fidelidade: recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let rita: Session;
  let orgId = '';
  let corte = { id: '' };
  let barba = { id: '' };
  let paulaId = '';
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });
  const newClient = async (name: string) =>
    (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name, phone: `119${Math.floor(10_000_000 + Math.random() * 89_999_999)}` }).expect(201)).body.id as string;
  const order = async (clientId?: string) => (await http.post('/v1/org/orders').set(inOrg(rita)).send(clientId ? { clientId } : {}).expect(201)).body.id as string;
  const addItem = (id: string, body: object) => http.post(`/v1/org/orders/${id}/items`).set(inOrg(rita)).send(body);
  const pay = (id: string, body: object) => http.post(`/v1/org/orders/${id}/payments`).set(inOrg(rita)).send(body);
  const close = (id: string) => http.post(`/v1/org/orders/${id}/close`).set(inOrg(rita));
  const cancel = (id: string) => http.post(`/v1/org/orders/${id}/cancel`).set(inOrg(rita));
  async function sell(clientId: string, item: object, total: number) {
    const id = await order(clientId);
    await addItem(id, item).expect(201);
    if (total > 0) await pay(id, { method: 'PIX', amountCents: total }).expect(201);
    await close(id).expect(200);
    return id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Recusas', 'dona-recusas@skedulei.test');
    const org = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Recusas', {
          services: [
            { name: 'Corte', category: 'Cabelo', durationMinutes: 45, priceCents: 8000 },
            { name: 'Barba', category: 'Barba', durationMinutes: 20, priceCents: 3000 },
          ],
          team: [
            { name: 'Paula Pro', email: 'paula-recusas@skedulei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Rita Recepção', email: 'rita-recusas@skedulei.test', role: 'RECEPCAO', bookable: false },
          ],
        }),
      )
      .expect(201);
    orgId = org.body.id;
    const services = (await http.get('/v1/org/services').set(inOrg(dona)).expect(200)).body as { id: string; name: string }[];
    corte = services.find((s) => s.name === 'Corte')!;
    barba = services.find((s) => s.name === 'Barba')!;
    paulaId = ((await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { id: string; name: string }[]).find((m) => m.name === 'Paula Pro')!.id;
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === 'rita-recusas@skedulei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    rita = await registerUser(http, 'Rita', 'rita-recusas@skedulei.test');
    await http.post('/v1/invites/accept').set(rita.auth).send({ token }).expect(201);
    await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['ESTOQUE', 'PACOTES', 'ASSINATURAS', 'VALES', 'FIDELIDADE', 'COMISSOES'] }).expect(200);
    await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 0 }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('estoque', () => {
    it('edita o produto, filtra os movimentos e monta o relatório', async () => {
      const gel = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Gel', kind: 'VENDA', salePriceCents: 2500, costCents: 1000 }).expect(201)).body;
      const luva = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Luva', kind: 'INSUMO' }).expect(201)).body;
      const p = await http.patch(`/v1/org/stock/products/${gel.id}`).set(inOrg(dona)).send({ name: 'Gel Forte', unit: 'cx', minQuantity: 3, costCents: 1200, salePriceCents: 2800, active: true }).expect(200);
      expect(p.body).toMatchObject({ name: 'Gel Forte', unit: 'cx', minQuantity: 3, costCents: 1200, salePriceCents: 2800 });
      await http.patch(`/v1/org/stock/products/${gel.id}`).set(inOrg(dona)).send({ salePriceCents: null }).expect(400);
      // Insumo nunca tem preço de venda, mesmo que alguém mande.
      const l = await http.patch(`/v1/org/stock/products/${luva.id}`).set(inOrg(dona)).send({ salePriceCents: 500 }).expect(200);
      expect(l.body.salePriceCents).toBeNull();
      await http.patch(`/v1/org/stock/products/${NOBODY}`).set(inOrg(dona)).send({ name: 'Nada' }).expect(404);
      await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: NOBODY, kind: 'ENTRADA', quantity: 1 }).expect(404);

      await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: gel.id, kind: 'ENTRADA', quantity: 5, unitCostCents: 1200 }).expect(201);
      await http.post('/v1/org/stock/movements').set(inOrg(dona)).send({ productId: luva.id, kind: 'ENTRADA', quantity: 100 }).expect(201);
      const todos = (await http.get('/v1/org/stock/movements').set(inOrg(dona)).expect(200)).body;
      expect(todos).toHaveLength(2);
      const soGel = (await http.get(`/v1/org/stock/movements?productId=${gel.id}`).set(inOrg(dona)).expect(200)).body;
      expect(soGel).toHaveLength(1);
      expect(soGel[0]).toMatchObject({ productName: 'Gel Forte', orderNumber: null });

      // Venda pela comanda: o movimento passa a mostrar o número da comanda e o relatório soma o consumo.
      const ana = await newClient('Ana Gel');
      await sell(ana, { kind: 'PRODUTO', refId: gel.id }, 2800);
      const depois = (await http.get(`/v1/org/stock/movements?productId=${gel.id}`).set(inOrg(dona)).expect(200)).body;
      expect(depois[0].orderNumber).toEqual(expect.any(Number));

      const rel = (await http.get('/v1/org/stock/report').set(inOrg(dona)).expect(200)).body;
      expect(rel.items.find((i: { name: string }) => i.name === 'Gel Forte').consumedValueCents).toBeGreaterThan(0);
      expect(rel.items.find((i: { name: string }) => i.name === 'Luva').consumedValueCents).toBe(0);
    });

    it('ficha técnica: serviço, insumo repetido ou inexistente e esvaziar', async () => {
      const insumo = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Touca', kind: 'INSUMO' }).expect(201)).body;
      await http.put(`/v1/org/stock/services/${NOBODY}/supplies`).set(inOrg(dona)).send({ supplies: [] }).expect(404);
      await http.put(`/v1/org/stock/services/${barba.id}/supplies`).set(inOrg(dona)).send({ supplies: [{ productId: insumo.id, quantity: 1 }, { productId: insumo.id, quantity: 2 }] }).expect(400);
      await http.put(`/v1/org/stock/services/${barba.id}/supplies`).set(inOrg(dona)).send({ supplies: [{ productId: NOBODY, quantity: 1 }] }).expect(404);
      await http.put(`/v1/org/stock/services/${barba.id}/supplies`).set(inOrg(dona)).send({ supplies: [{ productId: insumo.id, quantity: 1 }] }).expect(200);
      const vazio = await http.put(`/v1/org/stock/services/${barba.id}/supplies`).set(inOrg(dona)).send({ supplies: [] }).expect(200);
      expect(vazio.body).toEqual([]);
    });
  });

  describe('itens da comanda', () => {
    it('serviço, avulso e produto: o que falta e o desconto que passa do valor', async () => {
      const id = await order();
      await addItem(id, { kind: 'SERVICO' }).expect(400);
      await addItem(id, { kind: 'SERVICO', serviceId: NOBODY }).expect(404);
      await addItem(id, { kind: 'SERVICO', serviceId: corte.id, discountCents: 9000 }).expect(400);
      await addItem(id, { kind: 'AVULSO', description: 'Sem valor' }).expect(400);
      await addItem(id, { kind: 'PRODUTO' }).expect(400);
      await addItem(id, { kind: 'PRODUTO', refId: NOBODY }).expect(404);
      const insumo = (await http.post('/v1/org/stock/products').set(inOrg(dona)).send({ name: 'Insumo Interno', kind: 'INSUMO' }).expect(201)).body;
      await addItem(id, { kind: 'PRODUTO', refId: insumo.id }).expect(404);
      await addItem(id, { kind: 'SERVICO', serviceId: NOBODY.replace('0000', '1111'), memberId: NOBODY }).expect(404);
      await addItem(id, { kind: 'SERVICO', serviceId: corte.id, memberId: NOBODY }).expect(404);
      await cancel(id).expect(200);
    });

    it('pacote e clube: precisam de cliente, de plano ativo e não repetem a mensalidade', async () => {
      const plan = (await http.post('/v1/org/package-plans').set(inOrg(dona)).send({ name: '3 barbas', serviceId: barba.id, sessions: 3, priceCents: 7000 }).expect(201)).body;
      const clube = (await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube Barba', priceCents: 5000, serviceId: barba.id, sessionsPerMonth: 1 }).expect(201)).body;
      const ana = await newClient('Ana Plano');
      const sem = await order();
      await addItem(sem, { kind: 'PACOTE', refId: plan.id }).expect(400);
      await addItem(sem, { kind: 'CLUBE', refId: clube.id }).expect(400);
      await addItem(sem, { kind: 'SESSAO_PACOTE', refId: NOBODY }).expect(400);
      await addItem(sem, { kind: 'SESSAO_CLUBE', refId: NOBODY, serviceId: barba.id }).expect(400);
      await cancel(sem).expect(200);

      const id = await order(ana);
      await addItem(id, { kind: 'PACOTE' }).expect(400);
      await addItem(id, { kind: 'PACOTE', refId: NOBODY }).expect(404);
      await addItem(id, { kind: 'CLUBE' }).expect(400);
      await addItem(id, { kind: 'CLUBE', refId: clube.id, quantity: 2 }).expect(400);
      await addItem(id, { kind: 'CLUBE', refId: NOBODY }).expect(404);
      await addItem(id, { kind: 'CLUBE', refId: clube.id }).expect(201);
      const twice = await addItem(id, { kind: 'CLUBE', refId: clube.id }).expect(400);
      expect(twice.body.message).toMatch(/já tem a mensalidade/);
      await cancel(id).expect(200);

      // Plano desativado some da venda.
      await http.patch(`/v1/org/package-plans/${plan.id}`).set(inOrg(dona)).send({ active: false, name: '3 barbas (antigo)', sessions: 4, validityDays: null }).expect(200);
      await addItem(await order(ana), { kind: 'PACOTE', refId: plan.id }).expect(404);
      await http.patch(`/v1/org/membership-plans/${clube.id}`).set(inOrg(dona)).send({ active: false }).expect(200);
      await addItem(await order(ana), { kind: 'CLUBE', refId: clube.id }).expect(404);
      await http.patch(`/v1/org/package-plans/${NOBODY}`).set(inOrg(dona)).send({ name: 'Nada' }).expect(404);
    });

    it('planos do clube: serviço inexistente, edição de campos e plano que não existe', async () => {
      await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube X', priceCents: 1000, serviceId: NOBODY }).expect(404);
      await http.post('/v1/org/package-plans').set(inOrg(dona)).send({ name: 'Pacote X', serviceId: NOBODY, sessions: 3, priceCents: 1000 }).expect(404);
      const plano = (await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube Livre', priceCents: 4000 }).expect(201)).body;
      expect(plano.sessionsPerMonth).toBeNull();
      const editado = await http.patch(`/v1/org/membership-plans/${plano.id}`).set(inOrg(dona)).send({ name: 'Clube Livre 2', priceCents: 4500, sessionsPerMonth: 4, active: true }).expect(200);
      expect(editado.body).toMatchObject({ name: 'Clube Livre 2', priceCents: 4500, sessionsPerMonth: 4 });
      const volta = await http.patch(`/v1/org/membership-plans/${plano.id}`).set(inOrg(dona)).send({ sessionsPerMonth: null }).expect(200);
      expect(volta.body.sessionsPerMonth).toBeNull();
      await http.patch(`/v1/org/membership-plans/${NOBODY}`).set(inOrg(dona)).send({ name: 'Nada' }).expect(404);
      await http.patch(`/v1/org/memberships/${NOBODY}`).set(inOrg(dona)).send({ status: 'PAUSADA' }).expect(404);
    });

    it('sessão de pacote e de clube: saldo, plano pausado, serviço errado e cancelada que não volta', async () => {
      const plan = (await http.post('/v1/org/package-plans').set(inOrg(dona)).send({ name: '2 cortes', serviceId: corte.id, sessions: 2, priceCents: 12_000 }).expect(201)).body;
      const clube = (await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube Corte', priceCents: 6000, serviceId: corte.id, sessionsPerMonth: 1 }).expect(201)).body;
      const bia = await newClient('Bia Sessões');
      await sell(bia, { kind: 'PACOTE', refId: plan.id }, 12_000);
      await sell(bia, { kind: 'CLUBE', refId: clube.id }, 6000);
      const [cp] = (await http.get(`/v1/org/client-packages?clientId=${bia}`).set(inOrg(rita)).expect(200)).body;
      const [m] = (await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body;
      const outra = await newClient('Outra Cliente');

      const id = await order(bia);
      await addItem(id, { kind: 'SESSAO_PACOTE' }).expect(400);
      await addItem(id, { kind: 'SESSAO_PACOTE', refId: cp.id, unitPriceCents: 100 }).expect(400);
      await addItem(id, { kind: 'SESSAO_PACOTE', refId: NOBODY }).expect(404);
      // O pacote é da Bia: em comanda de outra cliente não aparece.
      await addItem(await order(outra), { kind: 'SESSAO_PACOTE', refId: cp.id }).expect(404);
      await addItem(id, { kind: 'SESSAO_CLUBE', refId: m.id }).expect(400);
      await addItem(id, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id, discountCents: 10 }).expect(400);
      await addItem(id, { kind: 'SESSAO_CLUBE', refId: NOBODY, serviceId: corte.id }).expect(404);
      await addItem(id, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: barba.id }).expect(400);

      // Plano preso a um serviço que depois some do catálogo: 404 no serviço.
      const livre = (await http.post('/v1/org/membership-plans').set(inOrg(dona)).send({ name: 'Clube Aberto', priceCents: 3000 }).expect(201)).body;
      await sell(bia, { kind: 'CLUBE', refId: livre.id }, 3000);
      const ms = (await http.get(`/v1/org/memberships?clientId=${bia}`).set(inOrg(rita)).expect(200)).body as { id: string; planName: string }[];
      const aberta = ms.find((x) => x.planName === 'Clube Aberto')!;
      await addItem(id, { kind: 'SESSAO_CLUBE', refId: aberta.id, serviceId: NOBODY }).expect(404);

      // Pausada e vencida não usam.
      await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'PAUSADA' }).expect(200);
      const pausada = await addItem(id, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id }).expect(400);
      expect(pausada.body.message).toMatch(/não está ativa/);
      await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'ATIVA' }).expect(200);
      await db.query(`UPDATE "${db.getMetadata('ClientMembership').tableName}" SET paid_through = $1 WHERE id = $2`, [new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10), m.id]);
      const vencida = await addItem(id, { kind: 'SESSAO_CLUBE', refId: m.id, serviceId: corte.id }).expect(400);
      expect(vencida.body.message).toMatch(/vencida/);
      await cancel(id).expect(200);

      // Cancelar a assinatura é definitivo.
      await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'CANCELADA' }).expect(200);
      const volta = await http.patch(`/v1/org/memberships/${m.id}`).set(inOrg(dona)).send({ status: 'ATIVA' }).expect(400);
      expect(volta.body.message).toMatch(/não volta/);

      // Pacote usado até o fim.
      for (let i = 0; i < 2; i++) await sell(bia, { kind: 'SESSAO_PACOTE', refId: cp.id }, 0);
      const fim = await addItem(await order(bia), { kind: 'SESSAO_PACOTE', refId: cp.id }).expect(400);
      expect(fim.body.message).toMatch(/não está mais ativo/);
    });

    it('vale e pontos: recusas no pagamento e no resgate', async () => {
      const dani = await newClient('Dani Vale Recusas');
      const venda = await sell(dani, { kind: 'VALE', unitPriceCents: 5000 }, 5000);
      expect(venda).toBeTruthy();
      const [card] = (await http.get('/v1/org/gift-cards').set(inOrg(rita)).expect(200)).body;
      const id = await order(dani);
      await addItem(id, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
      await pay(id, { method: 'VALE_PRESENTE', amountCents: 1000 }).expect(400);
      await pay(id, { method: 'VALE_PRESENTE', amountCents: 1000, giftCode: 'ZZZZ-ZZZZ-ZZZZ' }).expect(404);
      await pay(id, { method: 'VALE_PRESENTE', amountCents: 9000, giftCode: card.code }).expect(400);
      // Gasta o vale inteiro em outra comanda; depois nada sobra para usar.
      const gasto = await order(dani);
      await addItem(gasto, { kind: 'SERVICO', serviceId: corte.id }).expect(201);
      await pay(gasto, { method: 'VALE_PRESENTE', amountCents: 5000, giftCode: card.code }).expect(201);
      await pay(id, { method: 'VALE_PRESENTE', amountCents: 100, giftCode: card.code }).expect(400);
      await cancel(gasto).expect(200);

      // Fidelidade desligada: não resgata.
      await http.post(`/v1/org/orders/${id}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(400);
      await http.patch('/v1/org').set(inOrg(dona)).send({ loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 } }).expect(200);
      const semCliente = await order();
      await http.post(`/v1/org/orders/${semCliente}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(400);
      await http.post(`/v1/org/orders/${id}/redeem`).set(inOrg(rita)).send({ points: 50 }).expect(400);
      await http.post(`/v1/org/orders/${id}/redeem`).set(inOrg(rita)).send({ points: 100 }).expect(400);
      // Com saldo, mas pedindo mais do que a conta comporta.
      await http.post(`/v1/org/loyalty/${dani}/adjust`).set(inOrg(dona)).send({ points: 1000, note: 'Cortesia' }).expect(201);
      const demais = await http.post(`/v1/org/orders/${id}/redeem`).set(inOrg(rita)).send({ points: 900 }).expect(400);
      expect(demais.body.message).toMatch(/pode usar até/);
      await http.post(`/v1/org/orders/${id}/redeem`).set(inOrg(rita)).send({ points: 800 }).expect(200);
      // Baixar o valor da conta reduz o resgate até caber.
      await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ discountCents: 7000 }).expect(200);
      const o = (await http.get(`/v1/org/orders/${id}`).set(inOrg(rita)).expect(200)).body;
      expect(o.loyalty.redeemedPoints).toBeLessThan(800);
      await cancel(id).expect(200);
      await cancel(semCliente).expect(200);
    });
  });

  describe('comanda', () => {
    it('listagem por data e por situação', async () => {
      const lista = await http.get(`/v1/org/orders?status=FECHADA&date=${TODAY}`).set(inOrg(rita)).expect(200);
      expect(lista.body.length).toBeGreaterThan(0);
      expect((await http.get('/v1/org/orders?date=2030-01-01').set(inOrg(rita)).expect(200)).body).toEqual([]);
    });

    it('abrir com agendamento, cliente ou profissional que não existem', async () => {
      await http.post('/v1/org/orders').set(inOrg(rita)).send({ appointmentIds: [NOBODY] }).expect(404);
      await http.post('/v1/org/orders').set(inOrg(rita)).send({ clientId: NOBODY }).expect(404);
      const id = await order();
      await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ clientId: NOBODY }).expect(404);
      const ana = await newClient('Ana Edição');
      const ok = await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ clientId: ana, notes: 'Sem pressa' }).expect(200);
      expect(ok.body).toMatchObject({ clientId: ana, notes: 'Sem pressa' });
      const bia = await newClient('Bia Troca');
      const troca = await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ clientId: bia }).expect(200);
      expect(troca.body.clientId).toBe(bia);
      const sem = await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ clientId: null }).expect(200);
      expect(sem.body.clientId).toBeNull();
      await http.patch(`/v1/org/orders/${id}`).set(inOrg(rita)).send({ discountCents: 10 }).expect(200);
      await http.patch(`/v1/org/orders/${NOBODY}`).set(inOrg(rita)).send({ notes: 'x' }).expect(404);
      await http.get(`/v1/org/orders/${NOBODY}`).set(inOrg(rita)).expect(404);
      await cancel(id).expect(200);
    });

    it('item, pagamento e fechamento: o que não existe, o que já está pago e a comanda vazia', async () => {
      const id = await order();
      await close(id).expect(400);
      await http.delete(`/v1/org/orders/${id}/items/${NOBODY}`).set(inOrg(rita)).expect(404);
      await http.delete(`/v1/org/orders/${id}/payments/${NOBODY}`).set(inOrg(rita)).expect(404);
      await addItem(id, { kind: 'SERVICO', serviceId: barba.id, memberId: paulaId }).expect(201);
      await pay(id, { method: 'PIX', amountCents: 3000 }).expect(201);
      const paga = await pay(id, { method: 'PIX', amountCents: 100 }).expect(400);
      expect(paga.body.message).toMatch(/já está paga/);
      await close(id).expect(200);
      await cancel(id).expect(200);
      const duas = await cancel(id).expect(400);
      expect(duas.body.message).toMatch(/já está cancelada/);
    });
  });
});
