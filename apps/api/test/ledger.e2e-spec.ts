/**
 * Contas a pagar/receber, DRE, fluxo de caixa e importação de clientes (banco agendei_test).
 *   pnpm --filter @agendei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn } from '@agendei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
const TODAY = todayIn(TZ);

describe('Contas, DRE, fluxo de caixa e importação (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let paula: Session;
  let rita: Session;
  let outra: Session;
  let orgId = '';
  let otherId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });
  let cats: { id: string; name: string; type: string }[] = [];

  async function join(name: string, email: string): Promise<Session> {
    const outbox = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = outbox.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Contas', 'dona-contas@agendei.test');
    orgId = (
      await http
        .post('/v1/organizations')
        .set(dona.auth)
        .send(
          newOrg('Salão Contas', {
            team: [
              { name: 'Paula Pro', email: 'paula-contas@agendei.test', role: 'PROFISSIONAL', bookable: true },
              { name: 'Rita Recepção', email: 'rita-contas@agendei.test', role: 'RECEPCAO', bookable: false },
            ],
          }),
        )
        .expect(201)
    ).body.id;
    paula = await join('Paula', 'paula-contas@agendei.test');
    rita = await join('Rita', 'rita-contas@agendei.test');
    outra = await registerUser(http, 'Outra Contas', 'outra-contas@agendei.test');
    otherId = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Contas', { segment: 'CLINICA_MEDICA' })).expect(201)).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('plano de contas padrão do segmento e conta principal', async () => {
    cats = (await http.get('/v1/org/finance/categories').set(inOrg(dona)).expect(200)).body;
    expect(cats.filter((c) => c.type === 'DESPESA').map((c) => c.name)).toEqual(expect.arrayContaining(['Aluguel e condomínio', 'Produtos de cabelo e química']));
    expect(cats.some((c) => c.type === 'RECEITA')).toBe(true);
    // Chamar de novo não duplica.
    expect((await http.get('/v1/org/finance/categories').set(inOrg(dona)).expect(200)).body).toHaveLength(cats.length);
    const accounts = (await http.get('/v1/org/finance/accounts').set(inOrg(dona)).expect(200)).body;
    expect(accounts).toEqual([expect.objectContaining({ name: 'Conta principal', active: true })]);
    // Editável: renomear, incluir, desativar.
    const renamed = await http.patch(`/v1/org/finance/categories/${cat('Marketing')}`).set(inOrg(dona)).send({ name: 'Marketing e anúncios' }).expect(200);
    expect(renamed.body.name).toBe('Marketing e anúncios');
    await http.post('/v1/org/finance/categories').set(inOrg(dona)).send({ name: 'Marketing e anúncios', type: 'DESPESA' }).expect(400);
    const novo = await http.post('/v1/org/finance/categories').set(inOrg(dona)).send({ name: 'Cursos', type: 'DESPESA' }).expect(201);
    await http.patch(`/v1/org/finance/categories/${novo.body.id}`).set(inOrg(dona)).send({ active: false }).expect(200);
    cats = (await http.get('/v1/org/finance/categories').set(inOrg(dona)).expect(200)).body;
    // O outro negócio é de clínica: tem o plano dele.
    const outras = (await http.get('/v1/org/finance/categories').set(inOrg(outra, otherId)).expect(200)).body as { name: string }[];
    expect(outras.map((c) => c.name)).toContain('Convênios e repasses');
    expect(outras.map((c) => c.name)).not.toContain('Cursos');
  });

  it('permissões: só financeiro vê e mexe; recepção e profissional não', async () => {
    for (const s of [rita, paula]) {
      await http.get('/v1/org/finance/payables').set(inOrg(s)).expect(403);
      await http.get('/v1/org/finance/receivables').set(inOrg(s)).expect(403);
      await http.get(`/v1/org/finance/dre?from=${TODAY}&to=${TODAY}`).set(inOrg(s)).expect(403);
      await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=30').set(inOrg(s)).expect(403);
      await http.post('/v1/org/finance/payables').set(inOrg(s)).send({ description: 'x', amountCents: 100, dueDate: TODAY }).expect(403);
    }
  });

  let rent: { id: string; recurrenceId: string; installment: number }[] = [];
  it('conta a pagar: valida, recorrência mensal, status calculado', async () => {
    const bad = await http.post('/v1/org/finance/payables').set(inOrg(dona)).send({ description: 'Aluguel', amountCents: 0, dueDate: TODAY }).expect(400);
    expect(bad.body.details).toEqual(expect.arrayContaining(['Informe um valor maior que zero']));
    await http.post('/v1/org/finance/payables').set(inOrg(dona)).send({ description: 'Aluguel', amountCents: 100, dueDate: 'ontem' }).expect(400);
    // Categoria de receita não serve para despesa.
    await http.post('/v1/org/finance/payables').set(inOrg(dona)).send({ description: 'Aluguel', amountCents: 100, dueDate: TODAY, categoryId: cat('Serviços') }).expect(400);

    const first = addDays(TODAY, -40);
    const res = await http
      .post('/v1/org/finance/payables')
      .set(inOrg(dona))
      .send({ description: 'Aluguel da sala', categoryId: cat('Aluguel e condomínio'), amountCents: 250000, dueDate: first, monthlyCount: 3 })
      .expect(201);
    rent = res.body;
    expect(rent).toHaveLength(3);
    expect(rent.map((p) => p.installment)).toEqual([1, 2, 3]);
    expect(new Set(rent.map((p) => p.recurrenceId)).size).toBe(1);
    expect(rent[0]).toMatchObject({ status: 'ATRASADO', categoryName: 'Aluguel e condomínio' });

    const list = (await http.get('/v1/org/finance/payables').set(inOrg(dona)).expect(200)).body;
    expect(list.items.map((p: { status: string }) => p.status)).toEqual(['ATRASADO', 'ATRASADO', 'PENDENTE']);
    expect(list.totals).toEqual({ pendingCents: 250000, overdueCents: 500000, paidCents: 0 });
    const only = (await http.get('/v1/org/finance/payables?status=ATRASADO').set(inOrg(dona)).expect(200)).body;
    expect(only.items).toHaveLength(2);
  });

  it('pagar: data não pode ser futura; paga não edita; desfazer volta a ficar atrasada', async () => {
    const [p1, , p3] = rent;
    await http.post(`/v1/org/finance/payables/${p1.id}/pay`).set(inOrg(dona)).send({ paidDate: addDays(TODAY, 1), method: 'PIX' }).expect(400);
    await http.post(`/v1/org/finance/payables/${p1.id}/pay`).set(inOrg(dona)).send({ paidDate: TODAY, method: 'BOLETO' }).expect(400);
    const paid = await http.post(`/v1/org/finance/payables/${p1.id}/pay`).set(inOrg(dona)).send({ paidDate: TODAY, method: 'PIX' }).expect(200);
    expect(paid.body).toMatchObject({ status: 'PAGO', paidDate: TODAY, paidMethod: 'PIX', accountName: 'Conta principal' });
    await http.post(`/v1/org/finance/payables/${p1.id}/pay`).set(inOrg(dona)).send({ paidDate: TODAY, method: 'PIX' }).expect(400);
    await http.patch(`/v1/org/finance/payables/${p1.id}`).set(inOrg(dona)).send({ amountCents: 1 }).expect(400);
    const edited = await http.patch(`/v1/org/finance/payables/${p3.id}`).set(inOrg(dona)).send({ amountCents: 260000 }).expect(200);
    expect(edited.body).toMatchObject({ amountCents: 260000, status: 'PENDENTE' });
    const reopened = await http.post(`/v1/org/finance/payables/${p1.id}/reopen`).set(inOrg(dona)).expect(200);
    expect(reopened.body).toMatchObject({ status: 'ATRASADO', paidDate: null });
    await http.post(`/v1/org/finance/payables/${p1.id}/reopen`).set(inOrg(dona)).expect(400);
    await http.post(`/v1/org/finance/payables/${p1.id}/pay`).set(inOrg(dona)).send({ paidDate: TODAY, method: 'PIX' }).expect(200);
  });

  it('despesas avulsas (luz, paga hoje) e apagar parcelas futuras', async () => {
    const luz = await http
      .post('/v1/org/finance/payables')
      .set(inOrg(dona))
      .send({ description: 'Conta de luz', categoryId: cat('Água, luz e internet'), amountCents: 30000, dueDate: TODAY })
      .expect(201);
    await http.post(`/v1/org/finance/payables/${luz.body[0].id}/pay`).set(inOrg(dona)).send({ paidDate: TODAY, method: 'DINHEIRO' }).expect(200);
    // Apagar "esta e as próximas" não mexe nas pagas nem nas anteriores.
    const net = (
      await http
        .post('/v1/org/finance/payables')
        .set(inOrg(dona))
        .send({ description: 'Internet', amountCents: 9000, dueDate: addDays(TODAY, 40), monthlyCount: 3 })
        .expect(201)
    ).body as { id: string }[];
    await http.post(`/v1/org/finance/payables/${net[0].id}/pay`).set(inOrg(dona)).send({ paidDate: addDays(TODAY, -1), method: 'PIX' }).expect(200);
    await http.delete(`/v1/org/finance/payables/${net[1].id}?futuras=true`).set(inOrg(dona)).expect(204);
    const left = (await http.get('/v1/org/finance/payables').set(inOrg(dona)).expect(200)).body.items.map((p: { id: string }) => p.id);
    expect(left).toContain(net[0].id);
    expect(left).not.toContain(net[1].id);
    expect(left).not.toContain(net[2].id);
    expect(left).toContain(rent[2].id);
    // Apagar só esta.
    await http.delete(`/v1/org/finance/payables/${net[0].id}`).set(inOrg(dona)).expect(204);
  });

  let orderId = '';
  it('recebíveis nascem do pagamento da comanda conforme o prazo (crédito D+30, PIX na hora)', async () => {
    await http
      .patch('/v1/org')
      .set(inOrg(dona))
      .send({ paymentMethods: [{ method: 'CARTAO_CREDITO', enabled: true, feeBps: 300, feeFixedCents: 0, settlementDays: 30 }] })
      .expect(200);
    await http.post('/v1/org/cash/open').set(inOrg(dona)).send({ openingCents: 0 }).expect(201);
    const o = await http.post('/v1/org/orders').set(inOrg(dona)).send({}).expect(201);
    orderId = o.body.id;
    await http.post(`/v1/org/orders/${orderId}/items`).set(inOrg(dona)).send({ kind: 'AVULSO', description: 'Hidratação', unitPriceCents: 10000 }).expect(201);
    await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(dona)).send({ method: 'CARTAO_CREDITO', amountCents: 6000 }).expect(201);
    await http.post(`/v1/org/orders/${orderId}/payments`).set(inOrg(dona)).send({ method: 'PIX', amountCents: 4000 }).expect(201);
    await http.post(`/v1/org/orders/${orderId}/close`).set(inOrg(dona)).expect(200);

    const list = (await http.get('/v1/org/finance/receivables').set(inOrg(dona)).expect(200)).body;
    expect(list.items).toHaveLength(2);
    const card = list.items.find((r: { method: string }) => r.method === 'CARTAO_CREDITO');
    const pix = list.items.find((r: { method: string }) => r.method === 'PIX');
    expect(card).toMatchObject({ amountCents: 5820, feeCents: 180, expectedDate: addDays(TODAY, 30), status: 'PENDENTE', source: 'COMANDA', orderNumber: 1 });
    expect(pix).toMatchObject({ amountCents: 4000, expectedDate: TODAY, receivedDate: TODAY, status: 'RECEBIDO' });
    expect(list.totals).toEqual({ pendingCents: 5820, overdueCents: 0, receivedCents: 4000 });
  });

  it('baixa manual, desfazer, lançamento avulso e regras', async () => {
    const list = (await http.get('/v1/org/finance/receivables').set(inOrg(dona)).expect(200)).body.items;
    const card = list.find((r: { method: string }) => r.method === 'CARTAO_CREDITO');
    await http.post(`/v1/org/finance/receivables/${card.id}/receive`).set(inOrg(dona)).send({ receivedDate: addDays(TODAY, 1) }).expect(400);
    const ok = await http.post(`/v1/org/finance/receivables/${card.id}/receive`).set(inOrg(dona)).send({ receivedDate: TODAY }).expect(200);
    expect(ok.body).toMatchObject({ status: 'RECEBIDO', accountName: 'Conta principal' });
    await http.post(`/v1/org/finance/receivables/${card.id}/receive`).set(inOrg(dona)).send({ receivedDate: TODAY }).expect(400);
    await http.post(`/v1/org/finance/receivables/${card.id}/reopen`).set(inOrg(dona)).expect(200);
    await http.delete(`/v1/org/finance/receivables/${card.id}`).set(inOrg(dona)).expect(400);

    const avulso = await http
      .post('/v1/org/finance/receivables')
      .set(inOrg(dona))
      .send({ description: 'Aluguel de cadeira', categoryId: cat('Outras receitas'), amountCents: 20000, expectedDate: addDays(TODAY, -3) })
      .expect(201);
    expect(avulso.body).toMatchObject({ source: 'AVULSO', status: 'ATRASADO', categoryName: 'Outras receitas' });
    await http.post('/v1/org/finance/receivables').set(inOrg(dona)).send({ description: 'x', amountCents: 100, expectedDate: TODAY, categoryId: cat('Aluguel e condomínio') }).expect(400);
    await http.post(`/v1/org/finance/receivables/${avulso.body.id}/receive`).set(inOrg(dona)).send({ receivedDate: TODAY }).expect(200);
    const extra = await http.post('/v1/org/finance/receivables').set(inOrg(dona)).send({ description: 'Sinal', amountCents: 1000, expectedDate: TODAY }).expect(201);
    await http.delete(`/v1/org/finance/receivables/${extra.body.id}`).set(inOrg(dona)).expect(204);
  });

  it('DRE do período: receita bruta → resultado', async () => {
    const dre = (await http.get(`/v1/org/finance/dre?from=${TODAY}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body;
    expect(dre).toMatchObject({
      salesGrossCents: 10000,
      otherRevenueCents: 20000,
      grossRevenueCents: 30000,
      discountsCents: 0,
      feesCents: 180,
      netRevenueCents: 29820,
      commissionsCents: 0,
      contributionCents: 29820,
      fixedExpensesCents: 280000, // aluguel (parcela 1 paga hoje) 250000 + luz 30000
      resultCents: 29820 - 280000,
    });
    expect(dre.expensesByCategory).toEqual([
      expect.objectContaining({ name: 'Aluguel e condomínio', cents: 250000 }),
      expect.objectContaining({ name: 'Água, luz e internet', cents: 30000 }),
    ]);
    await http.get(`/v1/org/finance/dre?from=${TODAY}&to=${addDays(TODAY, 400)}`).set(inOrg(dona)).expect(400);
    // Outro dia sem movimento: zerado.
    const vazio = (await http.get(`/v1/org/finance/dre?from=${addDays(TODAY, -5)}&to=${addDays(TODAY, -2)}`).set(inOrg(dona)).expect(200)).body;
    expect(vazio).toMatchObject({ grossRevenueCents: 0, fixedExpensesCents: 0, resultCents: 0 });
  });

  it('fluxo de caixa realizado e projetado 30/60/90', async () => {
    const real = (await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${TODAY}&to=${TODAY}`).set(inOrg(dona)).expect(200)).body;
    // Entradas: PIX 4000 + avulso 20000; saídas: aluguel 250000 + luz 30000.
    expect(real).toMatchObject({ mode: 'REALIZADO', inCents: 24000, outCents: 280000, netCents: -256000 });
    expect(real.buckets).toHaveLength(1);

    // Projetado 30 dias: parcela 2 do aluguel (250000, vencida: entra hoje) e a 3 (260000, ~+20d); crédito (5820) cai em D+30, fora da janela.
    const p30 = (await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=30').set(inOrg(dona)).expect(200)).body;
    expect(p30).toMatchObject({ mode: 'PROJETADO', from: TODAY, to: addDays(TODAY, 29), inCents: 0 });
    expect(p30.buckets).toHaveLength(30);
    expect(p30.outCents).toBe(510000);
    expect(p30.buckets[0]).toMatchObject({ start: TODAY, outCents: 250000 });
    const p60 = (await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=60').set(inOrg(dona)).expect(200)).body;
    expect(p60).toMatchObject({ inCents: 5820, outCents: 510000, bucket: 'semana' });
    const p90 = (await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=90&bucket=dia').set(inOrg(dona)).expect(200)).body;
    expect(p90.buckets).toHaveLength(90);
    expect(p90.buckets[89].balanceCents).toBe(5820 - 510000);
    await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=45').set(inOrg(dona)).expect(400);
    await http.get('/v1/org/finance/cashflow?mode=OUTRO').set(inOrg(dona)).expect(400);
  });

  it('atrasados entram no primeiro dia da projeção', async () => {
    await http.post('/v1/org/finance/payables').set(inOrg(dona)).send({ description: 'Fornecedor', amountCents: 7000, dueDate: addDays(TODAY, -10) }).expect(201);
    const p30 = (await http.get('/v1/org/finance/cashflow?mode=PROJETADO&days=30').set(inOrg(dona)).expect(200)).body;
    expect(p30.buckets[0]).toMatchObject({ start: TODAY, outCents: 257000 });
  });

  it('estorno da comanda desfaz os recebíveis dela', async () => {
    const o = await http.post('/v1/org/orders').set(inOrg(dona)).send({}).expect(201);
    await http.post(`/v1/org/orders/${o.body.id}/items`).set(inOrg(dona)).send({ kind: 'AVULSO', description: 'Corte', unitPriceCents: 5000 }).expect(201);
    await http.post(`/v1/org/orders/${o.body.id}/payments`).set(inOrg(dona)).send({ method: 'CARTAO_CREDITO', amountCents: 5000 }).expect(201);
    const antes = (await http.get('/v1/org/finance/receivables').set(inOrg(dona)).expect(200)).body.items.length;
    await http.post(`/v1/org/orders/${o.body.id}/cancel`).set(inOrg(dona)).expect(200);
    expect((await http.get('/v1/org/finance/receivables').set(inOrg(dona)).expect(200)).body.items.length).toBe(antes - 1);
  });

  it('isolamento entre negócios: lê, altera e baixa só o que é seu', async () => {
    const payable = rent[0].id;
    const recv = (await http.get('/v1/org/finance/receivables').set(inOrg(dona)).expect(200)).body.items[0].id;
    const eles = inOrg(outra, otherId);
    expect((await http.get('/v1/org/finance/payables').set(eles).expect(200)).body.items).toEqual([]);
    expect((await http.get('/v1/org/finance/receivables').set(eles).expect(200)).body.items).toEqual([]);
    await http.patch(`/v1/org/finance/payables/${payable}`).set(eles).send({ amountCents: 1 }).expect(404);
    await http.post(`/v1/org/finance/payables/${payable}/pay`).set(eles).send({ paidDate: TODAY, method: 'PIX' }).expect(404);
    await http.post(`/v1/org/finance/payables/${payable}/reopen`).set(eles).expect(404);
    await http.delete(`/v1/org/finance/payables/${payable}`).set(eles).expect(404);
    await http.post(`/v1/org/finance/receivables/${recv}/receive`).set(eles).send({ receivedDate: TODAY }).expect(404);
    await http.delete(`/v1/org/finance/receivables/${recv}`).set(eles).expect(404);
    // Categoria e conta de outro negócio não valem.
    await http.post('/v1/org/finance/payables').set(eles).send({ description: 'x', amountCents: 100, dueDate: TODAY, categoryId: cat('Aluguel e condomínio') }).expect(400);
    const cats2 = (await http.get('/v1/org/finance/categories').set(eles).expect(200)).body as { id: string }[];
    expect(cats2.find((c) => cats.some((m) => m.id === c.id))).toBeUndefined();
    await http.patch(`/v1/org/finance/categories/${cat('Aluguel e condomínio')}`).set(eles).send({ name: 'Hackeado' }).expect(404);
    const accountId = (await http.get('/v1/org/finance/accounts').set(inOrg(dona)).expect(200)).body[0].id;
    const mine = await http.post('/v1/org/finance/payables').set(eles).send({ description: 'Deles', amountCents: 100, dueDate: TODAY }).expect(201);
    await http.post(`/v1/org/finance/payables/${mine.body[0].id}/pay`).set(eles).send({ paidDate: TODAY, method: 'PIX', accountId }).expect(400);
    await http.patch(`/v1/org/finance/accounts/${accountId}`).set(eles).send({ name: 'Hackeada' }).expect(404);
    // DRE e fluxo deles não enxergam o nosso.
    const dre = (await http.get(`/v1/org/finance/dre?from=${TODAY}&to=${TODAY}`).set(eles).expect(200)).body;
    expect(dre.grossRevenueCents).toBe(0);
    expect(dre.fixedExpensesCents).toBe(0);
    const flow = (await http.get(`/v1/org/finance/cashflow?mode=REALIZADO&from=${TODAY}&to=${TODAY}`).set(eles).expect(200)).body;
    expect(flow.inCents + flow.outCents).toBe(0);
  });

  describe('importação de clientes por CSV', () => {
    const csv = [
      'Nome;Celular;E-mail;Nascimento;Etiquetas;Observações',
      'Ana Souza;(11) 98888-7777;ana@x.com;05/03/1990;vip|retorno;alergia a látex',
      'Ana de novo;11988887777;;;;',
      'Beto Lima;11977776666;;;;',
      ';11966665555;;;;',
      'Caio;123;;;;',
      '=HYPERLINK("http://x");11955554444;;;;',
    ].join('\n');

    it('pré-visualiza sem gravar', async () => {
      const p = await http.post('/v1/org/clients/import/preview').set(inOrg(dona)).send({ csv }).expect(200);
      expect(p.body.counts).toEqual({ ok: 3, duplicated: 1, errors: 2, total: 6 });
      expect(p.body.rows[1]).toMatchObject({ status: 'DUPLICADO', line: 3 });
      expect((await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body).toEqual([]);
    });

    it('importa as válidas, ignora duplicados e mostra o relatório', async () => {
      const r = await http.post('/v1/org/clients/import').set(inOrg(dona)).send({ csv }).expect(200);
      expect(r.body).toMatchObject({ imported: 3, duplicated: 1, errors: 2 });
      expect(r.body.rows.map((x: { status: string }) => x.status)).toEqual(['DUPLICADO', 'ERRO', 'ERRO']);
      const clients = (await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body as { name: string; phone: string; tags: string[] }[];
      expect(clients).toHaveLength(3);
      expect(clients.find((c) => c.name === 'Ana Souza')).toMatchObject({ phone: '11988887777', tags: ['vip', 'retorno'] });
      // Segunda importação do mesmo arquivo: ninguém novo (dedupe por celular dentro do negócio).
      const again = await http.post('/v1/org/clients/import').set(inOrg(dona)).send({ csv }).expect(200);
      expect(again.body).toMatchObject({ imported: 0, duplicated: 4, errors: 2 });
      expect((await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body).toHaveLength(3);
    });

    it('observação importada fica cifrada e volta na ficha', async () => {
      const [ana] = (await http.get('/v1/org/clients?q=Ana').set(inOrg(dona)).expect(200)).body as { id: string }[];
      const ficha = (await http.get(`/v1/org/clients/${ana.id}`).set(inOrg(dona)).expect(200)).body;
      expect(ficha.notes).toBe('alergia a látex');
    });

    it('só quem gerencia clientes importa; arquivo ruim volta 400', async () => {
      await http.post('/v1/org/clients/import').set(inOrg(paula)).send({ csv }).expect(403);
      await http.post('/v1/org/clients/import/preview').set(inOrg(paula)).send({ csv }).expect(403);
      await http.post('/v1/org/clients/import').set(inOrg(rita)).send({ csv: 'Nome\nRita Importou' }).expect(200);
      await http.post('/v1/org/clients/import').set(inOrg(dona)).send({ csv: 'celular\n11999990000' }).expect(400);
      await http.post('/v1/org/clients/import').set(inOrg(dona)).send({}).expect(400);
    });

    it('isolamento: o mesmo celular em outro negócio não é duplicado e não vaza', async () => {
      const r = await http.post('/v1/org/clients/import').set(inOrg(outra, otherId)).send({ csv }).expect(200);
      expect(r.body.imported).toBe(3);
      const delas = (await http.get('/v1/org/clients').set(inOrg(outra, otherId)).expect(200)).body as unknown[];
      expect(delas).toHaveLength(3);
      expect((await http.get('/v1/org/clients').set(inOrg(dona)).expect(200)).body).toHaveLength(4);
    });
  });
});
