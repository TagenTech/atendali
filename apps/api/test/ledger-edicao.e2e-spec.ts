/**
 * Contas a pagar/receber: filtros, edição, contas bancárias e erros de regra (banco skedulei_test).
 * Complementa `ledger.e2e-spec.ts` (fluxo feliz) com os caminhos de edição e recusa.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, ORG_HEADER, todayIn } from '@skedulei/contracts';
import { createTestApp, newOrg, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TODAY = todayIn('America/Sao_Paulo');

describe('Contas: edição, filtros e recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dona: Session;
  let orgId = '';
  const inOrg = () => ({ ...dona.auth, [ORG_HEADER]: orgId });
  const get = (url: string) => http.get(`/v1/org/finance/${url}`).set(inOrg());
  const post = (url: string, body: object = {}) => http.post(`/v1/org/finance/${url}`).set(inOrg()).send(body);
  const patch = (url: string, body: object) => http.patch(`/v1/org/finance/${url}`).set(inOrg()).send(body);
  let despesa = '';
  let receita = '';

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    dona = await registerUser(http, 'Dona Edição', 'dona-edicao@skedulei.test');
    orgId = (await http.post('/v1/organizations').set(dona.auth).send(newOrg('Salão Edição')).expect(201)).body.id;
    const cats = (await get('categories').expect(200)).body as { id: string; type: string }[];
    despesa = cats.find((c) => c.type === 'DESPESA')!.id;
    receita = cats.find((c) => c.type === 'RECEITA')!.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('contas bancárias: criar, renomear e desativar', async () => {
    const nova = (await post('accounts', { name: 'Cofre' }).expect(201)).body;
    expect(nova).toMatchObject({ name: 'Cofre', active: true });
    expect((await patch(`accounts/${nova.id}`, { name: 'Cofre da loja' }).expect(200)).body.name).toBe('Cofre da loja');
    expect((await patch(`accounts/${nova.id}`, { active: false }).expect(200)).body).toMatchObject({ name: 'Cofre da loja', active: false });
    await patch('accounts/00000000-0000-0000-0000-000000000000', { name: 'x' }).expect(404);
    const lista = (await get('accounts').expect(200)).body as { name: string }[];
    expect(lista.map((a) => a.name)).toEqual(expect.arrayContaining(['Conta principal', 'Cofre da loja']));
  });

  it('conta a pagar: filtros por período e status, edição campo a campo e recusas', async () => {
    const ontem = addDays(TODAY, -1);
    const amanha = addDays(TODAY, 1);
    const atrasada = (await post('payables', { description: 'Luz', amountCents: 10000, dueDate: ontem, categoryId: despesa }).expect(201)).body[0];
    const futura = (await post('payables', { description: 'Aluguel', amountCents: 50000, dueDate: amanha }).expect(201)).body[0];
    const paga = (await post('payables', { description: 'Internet', amountCents: 9000, dueDate: ontem }).expect(201)).body[0];
    await post(`payables/${paga.id}/pay`, { paidDate: TODAY, method: 'PIX' }).expect(200);

    const ids = async (q: string) => ((await get(`payables?${q}`).expect(200)).body.items as { id: string }[]).map((i) => i.id);
    expect(await ids(`status=PAGO`)).toEqual([paga.id]);
    expect(await ids(`status=PENDENTE`)).toEqual([futura.id]);
    expect(await ids(`status=ATRASADO`)).toEqual([atrasada.id]);
    expect(await ids(`from=${TODAY}`)).toEqual([futura.id]);
    expect(await ids(`to=${ontem}`)).toEqual(expect.arrayContaining([atrasada.id, paga.id]));
    expect(await ids(`from=${TODAY}&to=${TODAY}`)).toEqual([]);

    const editada = (await patch(`payables/${atrasada.id}`, { description: 'Conta de luz', categoryId: null, dueDate: amanha, notes: 'Vence logo' }).expect(200)).body;
    expect(editada).toMatchObject({ description: 'Conta de luz', categoryId: null, dueDate: amanha, notes: 'Vence logo' });
    expect((await patch(`payables/${atrasada.id}`, { categoryId: despesa, notes: null }).expect(200)).body).toMatchObject({ categoryId: despesa, notes: null });
    await patch(`payables/${atrasada.id}`, { categoryId: receita }).expect(400); // categoria de receita não serve para despesa
    await patch(`payables/${paga.id}`, { description: 'Já paga' }).expect(400); // paga não se edita
  });

  it('conta a receber: filtros, edição de avulsa, baixa e reabertura com recusas', async () => {
    const ontem = addDays(TODAY, -1);
    const amanha = addDays(TODAY, 1);
    const atrasado = (await post('receivables', { description: 'Aluguel de sala', amountCents: 30000, expectedDate: ontem, categoryId: receita }).expect(201)).body;
    const futuro = (await post('receivables', { description: 'Curso', amountCents: 20000, expectedDate: amanha }).expect(201)).body;
    const recebido = (await post('receivables', { description: 'Venda', amountCents: 5000, expectedDate: ontem }).expect(201)).body;
    await post(`receivables/${recebido.id}/receive`, { receivedDate: TODAY }).expect(200);

    const ids = async (q: string) => ((await get(`receivables?${q}`).expect(200)).body.items as { id: string }[]).map((i) => i.id);
    expect(await ids('status=RECEBIDO')).toEqual([recebido.id]);
    expect(await ids('status=PENDENTE')).toEqual([futuro.id]);
    expect(await ids('status=ATRASADO')).toEqual([atrasado.id]);
    expect(await ids(`from=${TODAY}`)).toEqual([futuro.id]);
    expect(await ids(`to=${ontem}`)).toEqual(expect.arrayContaining([atrasado.id, recebido.id]));

    const editado = (await patch(`receivables/${atrasado.id}`, { description: 'Sala 2', categoryId: null, expectedDate: amanha, notes: 'combinado' }).expect(200)).body;
    expect(editado).toMatchObject({ description: 'Sala 2', categoryId: null, expectedDate: amanha, notes: 'combinado' });
    expect((await patch(`receivables/${atrasado.id}`, { notes: null }).expect(200)).body.notes).toBeNull();
    expect((await patch(`receivables/${atrasado.id}`, {}).expect(200)).body.description).toBe('Sala 2'); // nada a mudar
    await patch(`receivables/${atrasado.id}`, { categoryId: despesa }).expect(400);
    await patch(`receivables/${recebido.id}`, { description: 'x' }).expect(400); // já recebido

    await post(`receivables/${atrasado.id}/reopen`).expect(400); // ainda não foi recebido
    await post(`receivables/${recebido.id}/receive`, { receivedDate: TODAY }).expect(400); // já recebido
    await post(`receivables/${atrasado.id}/receive`, { receivedDate: addDays(TODAY, 3) }).expect(400); // futuro
    await post(`receivables/${atrasado.id}/receive`, { receivedDate: TODAY, accountId: '00000000-0000-0000-0000-000000000000' }).expect(400);
    await post(`receivables/${recebido.id}/reopen`).expect(200);
    await http.delete(`/v1/org/finance/receivables/${recebido.id}`).set(inOrg()).expect(204);
    await http.delete(`/v1/org/finance/receivables/${recebido.id}`).set(inOrg()).expect(404);
  });
});
