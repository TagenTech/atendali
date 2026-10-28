import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { Permission } from '@skedulei/contracts';

export const PASSWORD = 'senha-forte-123';
export const ALL_FEATURES = ['COMISSOES', 'ESTOQUE', 'PACOTES', 'ASSINATURAS', 'VALES', 'FIDELIDADE'];

/** Terça-feira 7 a 13 dias à frente, no fuso de São Paulo (dia útil com horário livre). */
export function nextTuesday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Seen {
  consoleErrors: string[];
  failedRequests: string[];
}

/** Junta erros de console, exceções da página e respostas 5xx — qualquer um deles falha o teste. */
export function watch(page: Page): Seen {
  const seen: Seen = { consoleErrors: [], failedRequests: [] };
  page.on('pageerror', (e) => seen.consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Recurso que falhou ao carregar vem como "Failed to load resource" (já contado em failedRequests).
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) seen.consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 500) seen.failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return seen;
}

export const expectClean = (seen: Seen, where: string) => {
  expect(seen.failedRequests, `respostas 5xx em ${where}`).toEqual([]);
  expect(seen.consoleErrors, `erros de console em ${where}`).toEqual([]);
};

/** A página não pode ter rolagem horizontal (quebra de layout no celular). */
export async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `rolagem horizontal em ${where}`).toBeLessThanOrEqual(1);
}

export interface Account {
  token: string;
  email: string;
}

/** Cadastra pela API (a sessão por cookie fica no contexto do navegador, sem gastar o limite de logins). */
export async function signUp(context: BrowserContext, name: string, email: string): Promise<Account> {
  const res = await context.request.post('/api/v1/auth/register', { data: { name, email, password: PASSWORD, acceptTerms: true } });
  expect(res.status(), 'cadastro').toBe(201);
  return { token: (await res.json()).accessToken as string, email };
}

const bearer = (a: Account, orgId?: string) => ({ authorization: `Bearer ${a.token}`, ...(orgId ? { 'x-organization-id': orgId } : {}) });

export interface SeededOrg {
  id: string;
  slug: string;
  owner: Account;
}

/** Negócio de barbearia com todos os módulos ligados, 2 profissionais e dados mínimos. */
export async function createBusiness(context: BrowserContext, stamp: string, segment = 'BARBEARIA'): Promise<SeededOrg> {
  const owner = await signUp(context, 'Dono Regressão', `dono-reg+${stamp}@skedulei.test`);
  const hours = [[], ...Array(5).fill([{ start: '09:00', end: '19:00' }]), [{ start: '09:00', end: '14:00' }]];
  const created = await context.request.post('/api/v1/organizations', {
    headers: bearer(owner),
    data: {
      name: `Regressão ${stamp}`,
      segment,
      unit: { name: 'Principal', city: 'São Paulo', state: 'sp', businessHours: hours },
      services: [
        { name: 'Corte', category: 'Cabelo', durationMinutes: 40, priceCents: 5000 },
        { name: 'Barba', category: 'Barba', durationMinutes: 30, priceCents: 3000 },
      ],
      ownerBookable: true,
    },
  });
  expect(created.status(), 'criar negócio').toBe(201);
  const org = await created.json();
  const patch = await context.request.patch('/api/v1/org', {
    headers: bearer(owner, org.id),
    data: { features: ALL_FEATURES, loyalty: { enabled: true, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 } },
  });
  expect(patch.status(), 'ligar módulos').toBe(200);
  return { id: org.id, slug: org.slug, owner };
}

/** Convida alguém com o perfil, cadastra a pessoa num contexto novo e aceita o convite. Devolve o contexto já logado. */
export async function addMember(browser: Browser, org: SeededOrg, owner: BrowserContext, role: string, name: string, stamp: string) {
  const email = `${role.toLowerCase()}-reg+${stamp}@skedulei.test`;
  const invited = await owner.request.post('/api/v1/org/members', {
    headers: bearer(org.owner, org.id),
    data: { name, email, role, bookable: role === 'PROFISSIONAL' },
  });
  expect(invited.status(), `convidar ${role}`).toBe(201);
  const outbox = (await (await owner.request.get('/api/v1/dev/outbox')).json()) as { to: string; link?: string }[];
  const token = outbox.filter((m) => m.to === email && m.link?.includes('/convite?')).at(-1)!.link!.split('token=')[1];
  const context = await browser.newContext();
  const account = await signUp(context, name, email);
  const accepted = await context.request.post('/api/v1/invites/accept', { headers: bearer(account), data: { token } });
  expect(accepted.status(), `aceitar convite ${role}`).toBe(201);
  return { context, account, email };
}

export type { Permission };
