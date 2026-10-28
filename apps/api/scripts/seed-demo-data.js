/**
 * Enche as contas demo (criadas por seed-demo.js) com movimento simulado dos últimos 30 dias:
 * equipe, clientes, agenda (passado, hoje e próximos dias), caixa, comandas, comissões, contas a pagar,
 * estoque, pacotes, clube, vales, pontos e avaliações. Só roda em negócio sem comandas fechadas.
 *   node scripts/seed-demo-data.js [http://localhost:3200/v1] [postgres://…/skedulei]
 */
const { Client: Pg } = require('pg');
const { SEGMENT_PRESETS, SEGMENTS, ORG_HEADER } = require('@skedulei/contracts');

const API = process.argv[2] ?? 'http://localhost:3200/v1';
const DB = process.argv[3] ?? process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/skedulei';
require('./demo-guard').assertLocal(DB);
require('./demo-guard').assertLocal(API);
const PASSWORD = 'senha-forte-123';
const WEB = 'http://localhost:3201';

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pad = (n) => String(n).padStart(2, '0');

async function call(method, path, { token, org, body } = {}) {
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(org ? { [ORG_HEADER]: org } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 15_000)); // limite de logins por minuto
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.message ?? '')}`), { status: res.status });
  return json;
}
const soft = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return null;
  }
};

const FIRST = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo'];
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Ribeiro', 'Almeida', 'Carvalho'];
const COMMENTS = ['Atendimento excelente, voltarei!', 'Muito atenciosos e pontuais.', 'Adorei o resultado.', 'Ambiente limpo e agradável.', 'Bom, mas atrasou um pouco.', 'Recomendo a todos!'];
const PRO_NAMES = ['Helena Rocha', 'Marcos Vieira', 'Tatiane Duarte'];

/** Data local de São Paulo (UTC−3) como instante UTC. */
const at = (daysAgo, hour, min = 0) => {
  const base = new Date();
  base.setUTCHours(12, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour + 3, min));
};
const dateOf = (d) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

async function populate(segment, pg) {
  const preset = SEGMENT_PRESETS[segment];
  const email = `demo-${segment.toLowerCase().replace(/_/g, '-')}@skedulei.test`;
  const token = (await call('POST', '/auth/login', { body: { email, password: PASSWORD } })).accessToken;
  const org = (await call('GET', '/organizations', { token }))[0];
  const o = { token, org: org.id };
  const done = await call('GET', '/org/orders?status=FECHADA', o);
  if (done.length) return console.log(`${preset.label}: já tem movimento (${done.length} comandas) — pulei`);

  // Equipe: dono + 3 profissionais e 1 recepção, sem acesso (convite fica pendente).
  const members = await call('GET', '/org/members', o);
  const pros = members.filter((m) => m.bookable);
  for (const [i, name] of PRO_NAMES.entries()) {
    if (!members.some((m) => m.name === name)) pros.push(await call('POST', '/org/members', { ...o, body: { name, role: 'PROFISSIONAL', bookable: true, commissionBps: [4000, 3500, 5000][i] } }));
  }
  if (!members.some((m) => m.role === 'RECEPCAO')) await soft(() => call('POST', '/org/members', { ...o, body: { name: 'Recepção Demo', role: 'RECEPCAO', bookable: false } }));
  await call('PATCH', `/org/members/${pros[0].id}`, { ...o, body: { commissionBps: 4500 } }).catch(() => null);

  const services = (await call('GET', '/org/services', o)).filter((s) => s.active);
  const priced = services.filter((s) => s.priceCents > 0);
  const products = await call('GET', '/org/stock/products', o);
  const sale = products.find((p) => p.kind === 'VENDA');
  const supply = products.find((p) => p.kind === 'INSUMO');
  if (sale) await call('POST', '/org/stock/movements', { ...o, body: { productId: sale.id, kind: 'ENTRADA', quantity: 40, unitCostCents: 2200 } });
  if (supply) {
    await call('POST', '/org/stock/movements', { ...o, body: { productId: supply.id, kind: 'ENTRADA', quantity: 600, unitCostCents: 15 } });
    await call('PUT', `/org/stock/services/${priced[0].id}/supplies`, { ...o, body: { supplies: [{ productId: supply.id, quantity: 20 }] } });
  }

  // Clientes
  const clients = [];
  for (let i = 0; i < 16; i++) {
    const name = `${FIRST[i]} ${pick(LAST)}`;
    clients.push(await call('POST', '/org/clients', { ...o, body: { name, phone: `119${String(80000000 + i * 1371 + Math.floor(rnd() * 999)).slice(0, 8)}`, email: i % 3 ? null : `${FIRST[i].toLowerCase()}@exemplo.com`, tags: i % 5 === 0 ? ['vip'] : [] } }));
  }

  // Caixa e histórico: ~45 atendimentos concluídos e pagos nos últimos 30 dias.
  await soft(() => call('POST', '/org/cash/open', { ...o, body: { openingCents: 10000 } }));
  const methods = ['PIX', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'];
  const taken = new Set();
  const closedOrders = [];
  let tries = 0;
  while (closedOrders.length < 45 && tries++ < 400) {
    const daysAgo = 1 + Math.floor(rnd() * 30);
    const when = at(daysAgo, 9 + Math.floor(rnd() * 8), pick([0, 30]));
    const dow = new Date(when.getTime() - 3 * 3600_000).getUTCDay();
    if (dow === 0) continue;
    const pro = pick(pros);
    const key = `${pro.id}${when.toISOString()}`;
    if (taken.has(key)) continue;
    taken.add(key);
    const svc = pick(priced);
    const client = pick(clients);
    const appt = await soft(() => call('POST', '/org/appointments', { ...o, body: { memberId: pro.id, serviceId: svc.id, clientId: client.id, startsAt: when.toISOString() } }));
    if (!appt) continue;
    let order = await soft(() => call('POST', '/org/orders', { ...o, body: { appointmentIds: [appt.id] } }));
    if (!order) continue;
    if (sale && closedOrders.length % 4 === 1) order = (await soft(() => call('POST', `/org/orders/${order.id}/items`, { ...o, body: { kind: 'PRODUTO', refId: sale.id, quantity: 1, memberId: pro.id } }))) ?? order;
    const method = pick(methods);
    const paid = await soft(() => call('POST', `/org/orders/${order.id}/payments`, { ...o, body: { method, amountCents: order.totals.dueCents } }));
    if (!paid) continue;
    const closed = await soft(() => call('POST', `/org/orders/${order.id}/close`, o));
    if (closed) closedOrders.push({ id: order.id, clientId: client.id });
  }

  // Fecha o caixa do histórico (conferido) e abre o de hoje.
  const cur = await call('GET', '/org/cash/current', o);
  if (cur) await soft(() => call('POST', '/org/cash/close', { ...o, body: { countedCents: cur.expected.drawerCents, notes: 'Fechamento simulado' } }));

  // Datas: as comandas, pagamentos, comissões e recebíveis passam para o dia do atendimento.
  await pg.query(
    `WITH m AS (SELECT oi.order_id, MIN(a.starts_at) st FROM skedulei_order_items oi JOIN skedulei_appointments a ON a.id = oi.appointment_id
                WHERE oi.organization_id = $1 AND a.starts_at < NOW() GROUP BY 1)
     UPDATE skedulei_orders o SET opened_at = m.st, closed_at = m.st + INTERVAL '50 minutes' FROM m WHERE o.id = m.order_id`,
    [org.id],
  );
  await pg.query(
    `UPDATE skedulei_order_payments p SET created_at = o.closed_at FROM skedulei_orders o
      WHERE p.order_id = o.id AND o.organization_id = $1 AND o.closed_at < NOW() - INTERVAL '2 hours'`,
    [org.id],
  );
  await pg.query(
    `UPDATE skedulei_receivables r SET expected_date = r.expected_date - (r.created_at::date - p.created_at::date),
            received_date = CASE WHEN r.received_date IS NULL THEN NULL ELSE r.received_date - (r.created_at::date - p.created_at::date) END,
            created_at = p.created_at
       FROM skedulei_order_payments p WHERE r.order_payment_id = p.id AND r.organization_id = $1 AND p.created_at::date < r.created_at::date`,
    [org.id],
  );
  await pg.query(
    `UPDATE skedulei_commission_entries c SET created_at = o.closed_at FROM skedulei_orders o
      WHERE c.order_id = o.id AND o.organization_id = $1 AND o.closed_at < NOW() - INTERVAL '2 hours'`,
    [org.id],
  );
  await pg.query(`UPDATE skedulei_cash_sessions SET opened_at = (SELECT MIN(opened_at) FROM skedulei_orders WHERE organization_id = $1) WHERE organization_id = $1 AND closed_at IS NOT NULL`, [org.id]);

  // Fechamento de comissão de uma pessoa (as outras ficam "a pagar").
  await soft(() => call('POST', '/org/commissions/payouts', { ...o, body: { memberId: pros[1].id } }));

  // Retenção: pacote, clube e vale; um vale e uma sessão usada.
  await call('POST', '/org/cash/open', { ...o, body: { openingCents: 15000 } }).catch(() => null);
  const sellOne = async (clientId, item, method = 'PIX') => {
    const ord = await call('POST', '/org/orders', { ...o, body: { clientId } });
    const withItem = await call('POST', `/org/orders/${ord.id}/items`, { ...o, body: item });
    if (withItem.totals.dueCents) await call('POST', `/org/orders/${ord.id}/payments`, { ...o, body: { method, amountCents: withItem.totals.dueCents } });
    return call('POST', `/org/orders/${ord.id}/close`, o);
  };
  const pkgPlan = (await soft(() => call('GET', '/org/package-plans', o)))?.[0];
  const clubPlan = (await soft(() => call('GET', '/org/membership-plans', o)))?.[0];
  if (pkgPlan) {
    for (const c of clients.slice(0, 3)) await soft(() => sellOne(c.id, { kind: 'PACOTE', refId: pkgPlan.id }));
    const mine = await call('GET', `/org/client-packages?clientId=${clients[0].id}`, o);
    if (mine[0]) await soft(() => sellOne(clients[0].id, { kind: 'SESSAO_PACOTE', refId: mine[0].id, memberId: pros[0].id }));
  }
  if (clubPlan) for (const c of clients.slice(3, 6)) await soft(() => sellOne(c.id, { kind: 'CLUBE', refId: clubPlan.id }, 'CARTAO_CREDITO'));
  await soft(() => sellOne(clients[7].id, { kind: 'VALE', unitPriceCents: 15000 }));

  // Hoje e próximos dias: agendados, confirmados, uma pessoa aguardando e uma em atendimento (aparecem no painel de TV).
  const todaySlots = [[0, 9, 'CONFIRMADO'], [0, 10, 'CHEGOU'], [0, 11, 'EM_ATENDIMENTO'], [0, 15, 'AGENDADO'], [0, 16, 'CONFIRMADO']];
  const future = [...todaySlots];
  for (let d = 1; d <= 7; d++) for (const h of [10, 14]) if (rnd() < 0.7) future.push([-d, h, rnd() < 0.5 ? 'CONFIRMADO' : 'AGENDADO']);
  let i = 0;
  for (const [daysAgo, hour, status] of future) {
    const when = at(daysAgo, hour);
    if (daysAgo === 0 && when.getTime() < Date.now() - 3600_000 && status === 'AGENDADO') continue;
    const dow = new Date(when.getTime() - 3 * 3600_000).getUTCDay();
    if (dow === 0) continue;
    const appt = await soft(() => call('POST', '/org/appointments', { ...o, body: { memberId: pros[i % pros.length].id, serviceId: pick(priced).id, clientId: clients[(i * 5) % clients.length].id, startsAt: when.toISOString(), allowOutsideHours: true } }));
    i++;
    if (appt && status !== 'AGENDADO') {
      const steps = { CONFIRMADO: ['CONFIRMADO'], CHEGOU: ['CONFIRMADO', 'CHEGOU'], EM_ATENDIMENTO: ['CONFIRMADO', 'CHEGOU', 'EM_ATENDIMENTO'] }[status];
      for (const s of steps) await soft(() => call('PATCH', `/org/appointments/${appt.id}`, { ...o, body: { status: s } }));
    }
  }
  // Um cancelamento e uma falta no histórico recente.
  for (const [daysAgo, hour, st] of [[2, 13, 'CANCELADO'], [4, 12, 'FALTOU']]) {
    const a = await soft(() => call('POST', '/org/appointments', { ...o, body: { memberId: pros[2].id, serviceId: pick(priced).id, clientId: pick(clients).id, startsAt: at(daysAgo, hour).toISOString() } }));
    if (a) await soft(() => call('PATCH', `/org/appointments/${a.id}`, { ...o, body: { status: st === 'FALTOU' ? 'CONFIRMADO' : st } }));
    if (a && st === 'FALTOU') await soft(() => call('PATCH', `/org/appointments/${a.id}`, { ...o, body: { status: 'FALTOU' } }));
  }

  // Contas a pagar (pagas, a vencer e atrasada) e uma receita avulsa.
  const today = dateOf(new Date());
  const bills = [
    ['Aluguel', 350000, -20, true], ['Energia elétrica', 48000, -12, true], ['Internet', 15900, -8, true], ['Produtos e materiais', 126000, -5, true],
    ['Contador', 90000, 6, false], ['Aluguel (próximo mês)', 350000, 10, false], ['Fornecedor — atrasado', 42000, -3, false],
  ];
  for (const [description, amountCents, offset, pay] of bills) {
    const due = dateOf(new Date(Date.now() + offset * 86400_000));
    const p = await soft(() => call('POST', '/org/finance/payables', { ...o, body: { description, amountCents, dueDate: due } }));
    if (p && pay) await soft(() => call('POST', `/org/finance/payables/${p.id}/pay`, { ...o, body: { paidDate: due, method: 'PIX' } }));
  }
  await soft(() => call('POST', '/org/finance/receivables', { ...o, body: { description: 'Aluguel de cadeira', amountCents: 80000, expectedDate: dateOf(new Date(Date.now() + 5 * 86400_000)) } }));

  // Avaliações: parte dos atendimentos fechados com cliente responde pelo link público.
  let answered = 0;
  for (const c of closedOrders.slice(0, 14)) {
    const req = await soft(() => call('POST', `/org/orders/${c.id}/review-request`, o));
    if (!req) continue;
    const rating = rnd() < 0.8 ? 5 : pick([3, 4]);
    if (await soft(() => call('POST', `/public/reviews/${req.token}`, { body: { rating, comment: rnd() < 0.7 ? pick(COMMENTS) : null } }))) answered++;
  }
  console.log(`${preset.label.padEnd(22)} ${closedOrders.length} atendimentos pagos · ${answered} avaliações · ${clients.length} clientes · ${pros.length} profissionais`);
}

(async () => {
  const pg = new Pg({ connectionString: DB });
  await pg.connect();
  try {
    for (const segment of SEGMENTS) await populate(segment, pg);
  } finally {
    await pg.end();
  }
  console.log(`\nPronto. Entre em ${WEB}/login com demo-<segmento>@skedulei.test / ${PASSWORD}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
