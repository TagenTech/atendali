/**
 * Trilha de auditoria: quem fez o quê no dinheiro. Só o dono lê; nada vaza entre negócios; cliente excluído não deixa o nome.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ORG_HEADER, todayIn } from '@skedulei/contracts';
import { AuditEntry } from '../src/auditoria/audit-entry.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
interface Entry {
  action: string;
  summary: string;
  actorName: string;
}

describe('Auditoria (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let rita: Session;
  let gerente: Session;
  let outra: Session;
  let orgId = '';
  let otherOrgId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });
  // O formatador de moeda usa espaço não separável entre "R$" e o valor: nos testes vira espaço comum.
  const audit = async (q = '') =>
    ((await http.get(`/v1/org/audit${q}`).set(inOrg(dona)).expect(200)).body as Entry[]).map((e) => ({ ...e, summary: e.summary.replace(/\u00a0/g, ' ') }));

  async function joinTeam(email: string, role: string, name: string) {
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name, email, role, bookable: false }).expect(201);
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Auditoria', 'dona-auditoria@skedulei.test');
    orgId = (await http.post('/v1/organizations').set(dona.auth).send(newOrg('Salão Auditoria')).expect(201)).body.id;
    rita = await joinTeam('rita-auditoria@skedulei.test', 'RECEPCAO', 'Rita Recepção');
    gerente = await joinTeam('ger-auditoria@skedulei.test', 'GERENTE', 'Gabi Gerente');
    outra = await registerUser(http, 'Outra Dona', 'outra-auditoria@skedulei.test');
    otherOrgId = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outro Salão')).expect(201)).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('só o dono lê a trilha (gerente, recepção e outro negócio não)', async () => {
    await http.get('/v1/org/audit').set(inOrg(gerente)).expect(403);
    await http.get('/v1/org/audit').set(inOrg(rita)).expect(403);
    await http.get('/v1/org/audit?grupo=INVALIDO').set(inOrg(dona)).expect(400);
    await http.get('/v1/org/audit?dias=9999').set(inOrg(dona)).expect(400);
    expect(await audit()).toEqual([]);
  });

  it('caixa e comanda: cada ação sensível deixa registro com quem fez e o valor', async () => {
    await http.post('/v1/org/cash/open').set(inOrg(rita)).send({ openingCents: 10000 }).expect(201);
    const o = (await http.post('/v1/org/orders').set(inOrg(rita)).send({}).expect(201)).body;
    await http.post(`/v1/org/orders/${o.id}/items`).set(inOrg(rita)).send({ kind: 'AVULSO', description: 'Hidratação', unitPriceCents: 9000 }).expect(201);
    const withItem = (await http.get(`/v1/org/orders/${o.id}`).set(inOrg(rita)).expect(200)).body;
    await http.patch(`/v1/org/orders/${o.id}`).set(inOrg(rita)).send({ discountCents: 1500 }).expect(200);
    await http.patch(`/v1/org/orders/${o.id}`).set(inOrg(rita)).send({ discountCents: 1500 }).expect(200); // igual: não registra de novo
    await http.post(`/v1/org/orders/${o.id}/payments`).set(inOrg(rita)).send({ method: 'PIX', amountCents: 7500 }).expect(201);
    const paid = (await http.get(`/v1/org/orders/${o.id}`).set(inOrg(rita)).expect(200)).body;
    await http.delete(`/v1/org/orders/${o.id}/payments/${paid.payments[0].id}`).set(inOrg(rita)).expect(200);
    await http.delete(`/v1/org/orders/${o.id}/items/${withItem.items[0].id}`).set(inOrg(rita)).expect(200);
    await http.post('/v1/org/cash/movements').set(inOrg(rita)).send({ kind: 'SUPRIMENTO', amountCents: 2000, note: 'Troco' }).expect(201);
    await http.post(`/v1/org/orders/${o.id}/cancel`).set(inOrg(rita)).expect(200);
    await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 11500 }).expect(201);

    const list = await audit();
    const by = (a: string) => list.filter((e) => e.action === a);
    expect(by('CASH_OPENED')[0].summary).toBe('Caixa aberto com R$ 100,00 de troco inicial');
    expect(by('ORDER_DISCOUNT')).toHaveLength(1);
    expect(by('ORDER_DISCOUNT')[0].summary).toMatch(/de R\$ 0,00 para R\$ 15,00/);
    expect(by('PAYMENT_REMOVED')[0].summary).toMatch(/R\$ 75,00 \(PIX\) desfeito/);
    expect(by('ORDER_ITEM_REMOVED')[0].summary).toMatch(/Hidratação/);
    expect(by('CASH_MOVEMENT')[0].summary).toMatch(/Suprimento de R\$ 20,00 — Troco/);
    expect(by('ORDER_CANCELLED')[0].summary).toMatch(/cancelada \(sem pagamento\)/);
    expect(by('CASH_CLOSED')[0].summary).toMatch(/esperado R\$ 120,00, contado R\$ 115,00 \(falta de R\$ 5,00\)/);
    expect(list.every((e) => e.actorName === 'Rita Recepção')).toBe(true);
    // Mais novo primeiro.
    expect(list[0].action).toBe('CASH_CLOSED');
  });

  it('filtro por grupo; comissão, vale e contas também registram', async () => {
    const pros = (await http.get('/v1/org/members').set(inOrg(dona)).expect(200)).body as { id: string; name: string }[];
    await http.post('/v1/org/commissions/advances').set(inOrg(dona)).send({ memberId: pros[0].id, amountCents: 5000, note: 'Adiantamento' }).expect(201);
    await http.post('/v1/org/commissions/payouts').set(inOrg(dona)).send({ memberId: pros[0].id }).expect(201);
    const today = todayIn('America/Sao_Paulo');
    const p = (await http.post('/v1/org/finance/payables').set(inOrg(dona)).send({ description: 'Aluguel', amountCents: 300000, dueDate: today }).expect(201)).body;
    const id = (Array.isArray(p) ? p[0] : p).id;
    await http.post(`/v1/org/finance/payables/${id}/pay`).set(inOrg(gerente)).send({ paidDate: today, method: 'PIX' }).expect(200);
    await http.post(`/v1/org/finance/payables/${id}/reopen`).set(inOrg(dona)).expect(200);
    await http.delete(`/v1/org/finance/payables/${id}`).set(inOrg(dona)).expect(204);

    const contas = await audit('?grupo=CONTAS');
    expect(contas.map((e) => e.action).sort()).toEqual(['PAYABLE_PAID', 'PAYABLE_REMOVED', 'PAYABLE_REOPENED']);
    expect(contas.find((e) => e.action === 'PAYABLE_PAID')).toMatchObject({ actorName: 'Gabi Gerente' }); // o gerente também aparece
    expect(contas.find((e) => e.action === 'PAYABLE_REMOVED')!.summary).toMatch(/Aluguel.*R\$ 3\.000,00.*apagada/);
    const com = await audit('?grupo=COMISSOES');
    expect(com.map((e) => e.action).sort()).toEqual(['ADVANCE_ADDED', 'COMMISSION_PAID']);
    expect(com.find((e) => e.action === 'COMMISSION_PAID')!.summary).toMatch(/vales R\$ 50,00/);
    expect((await audit('?grupo=CAIXA')).every((e) => e.action.startsWith('CASH_'))).toBe(true);
  });

  it('excluir cliente (LGPD) registra o fato, mas não guarda o nome', async () => {
    const c = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Maria Sigilosa', phone: '11999990000' }).expect(201)).body;
    await http.delete(`/v1/org/clients/${c.id}`).set(inOrg(dona)).expect(204);
    const list = await audit('?grupo=CLIENTES');
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('Sigilosa');
    const raw = (await db.query(`SELECT summary, meta FROM ${quotedTable(db, AuditEntry)} WHERE action = 'CLIENT_ANONYMIZED'`)) as { summary: string; meta: unknown }[];
    expect(JSON.stringify(raw)).not.toContain('Sigilosa');
  });

  it('o outro negócio não vê nada deste, e a ação desfeita não deixa registro', async () => {
    expect((await http.get('/v1/org/audit').set(inOrg(outra, otherOrgId)).expect(200)).body).toEqual([]);
    const before = (await audit()).length;
    await http.post('/v1/org/cash/close').set(inOrg(rita)).send({ countedCents: 0 }).expect(400); // caixa fechado: falha e não registra
    expect((await audit()).length).toBe(before);
  });
});
