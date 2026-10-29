/**
 * Cria (ou atualiza) um usuário de demonstração para cada segmento, com todos os módulos ligados e dados de exemplo.
 *   node scripts/seed-demo.js [http://localhost:3200/v1]
 * Só para desenvolvimento: a senha é fixa e pública.
 */
const { SEGMENT_PRESETS, SEGMENTS, FEATURES, defaultBusinessHours, ORG_HEADER } = require('@skedulei/contracts');

const API = process.argv[2] ?? 'http://localhost:3200/v1';
require('./demo-guard').assertLocal(API);
const PASSWORD = 'senha-forte-123';

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
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${json?.message ?? ''}`), { status: res.status });
  return json;
}

async function session(name, email) {
  try {
    return (await call('POST', '/auth/register', { body: { name, email, password: PASSWORD, acceptTerms: true } })).accessToken;
  } catch {
    return (await call('POST', '/auth/login', { body: { email, password: PASSWORD } })).accessToken;
  }
}

async function seed(segment) {
  const preset = SEGMENT_PRESETS[segment];
  const slug = segment.toLowerCase().replace(/_/g, '-');
  const email = `demo-${slug}@skedulei.test`;
  const token = await session(`Demo ${preset.label}`, email);
  let orgs = await call('GET', '/organizations', { token });
  let org = orgs[0];
  if (!org) {
    org = await call('POST', '/organizations', {
      token,
      body: {
        name: `Demo ${preset.label}`,
        segment,
        unit: { name: 'Principal', city: 'São Paulo', state: 'sp', businessHours: defaultBusinessHours() },
        services: preset.sampleServices.map((s) => ({ name: s.name, category: s.category ?? null, durationMinutes: s.durationMinutes, priceCents: s.priceCents })),
        ownerBookable: true,
      },
    });
  }
  const o = { token, org: org.id };
  await call('PATCH', '/org', {
    ...o,
    body: {
      features: FEATURES,
      loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 },
      brandColor: ['violeta', 'rosa', 'azul', 'verde', 'laranja', 'grafite', 'dourado'][SEGMENTS.indexOf(segment) % 7],
      tagline: `Agende seu horário online — conta de demonstração (${preset.label.toLowerCase()})`,
    },
  });
  const services = await call('GET', '/org/services', o);
  const first = services[0];
  const hasPlan = (await call('GET', '/org/package-plans', o)).length;
  if (first && !hasPlan) {
    await call('POST', '/org/package-plans', { ...o, body: { name: `5 × ${first.name}`, serviceId: first.id, sessions: 5, priceCents: first.priceCents * 4, validityDays: 180 } });
    await call('POST', '/org/membership-plans', { ...o, body: { name: 'Clube mensal', priceCents: first.priceCents * 2, serviceId: first.id, sessionsPerMonth: 2 } });
    await call('POST', '/org/stock/products', { ...o, body: { name: 'Produto de revenda', kind: 'VENDA', unit: 'un', salePriceCents: 4500, minQuantity: 3 } });
    await call('POST', '/org/stock/products', { ...o, body: { name: 'Insumo de uso', kind: 'INSUMO', unit: 'ml', minQuantity: 100 } });
  }
  const clients = await call('GET', '/org/clients', o);
  if (!clients.length) await call('POST', '/org/clients', { ...o, body: { name: 'Cliente Exemplo', phone: '11988887777' } });
  console.log(`${preset.label.padEnd(18)} ${email}   /${org.slug}`);
}

(async () => {
  console.log(`Senha de todos: ${PASSWORD}\n`);
  for (const segment of SEGMENTS) await seed(segment);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
