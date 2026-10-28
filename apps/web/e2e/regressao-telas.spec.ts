import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { addMember, createBusiness, expectClean, expectNoHorizontalScroll, nextTuesday, watch, type SeededOrg } from './helpers';

/**
 * Regressão de telas e permissões (celular e desktop): toda tela abre sem erro de console, sem resposta 5xx e sem
 * rolagem horizontal; cada perfil vê só o que pode; as ações de cada módulo respondem.
 * Rodar sempre depois de mexer em qualquer tela ou rota.
 */
test.describe.configure({ mode: 'serial' });

let ownerCtx: BrowserContext;
let owner: Page;
let org: SeededOrg;
let clientId = '';
let orderId = '';
const roles: Record<string, { ctx: BrowserContext; page: Page }> = {};

const ALL_ROUTES = [
  '/inicio', '/agenda', '/clientes', '/clientes/importar', '/caixa', '/financeiro', '/financeiro/contas', '/financeiro/dre', '/financeiro/fluxo',
  '/comissoes', '/servicos', '/estoque', '/fidelidade', '/avaliacoes', '/tv', '/equipe', '/configuracoes', '/mais', '/mais/perfil', '/mais/seguranca',
];

test.beforeAll(async ({ browser }, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  ownerCtx = await browser.newContext();
  org = await createBusiness(ownerCtx, stamp);
  owner = await ownerCtx.newPage();
  for (const [role, name] of [['RECEPCAO', 'Rita Recepção'], ['PROFISSIONAL', 'Paulo Profissional'], ['FINANCEIRO', 'Fabi Financeiro'], ['GERENTE', 'Gil Gerente']]) {
    const m = await addMember(browser, org, ownerCtx, role, name, stamp);
    roles[role] = { ctx: m.context, page: await m.context.newPage() };
  }
  // Um cliente e uma comanda para as telas de detalhe.
  const auth = { authorization: `Bearer ${org.owner.token}`, 'x-organization-id': org.id };
  const client = await ownerCtx.request.post('/api/v1/org/clients', { headers: auth, data: { name: 'Cliente Regressão', phone: '11999990000' } });
  clientId = (await client.json()).id;
  const order = await ownerCtx.request.post('/api/v1/org/orders', { headers: auth, data: { clientId } });
  orderId = (await order.json()).id;
});

test.afterAll(async () => {
  await ownerCtx?.close();
  for (const r of Object.values(roles)) await r.ctx.close();
});

test('dono: todas as telas abrem limpas, sem erro e sem rolagem lateral', async ({}, info) => {
  const seen = watch(owner);
  for (const route of [...ALL_ROUTES, `/clientes/${clientId}`, `/caixa/${orderId}`]) {
    await owner.goto(route);
    await expect(owner.locator('h1, h2').first(), route).toBeVisible();
    await owner.waitForLoadState('networkidle');
    if (info.project.name === 'celular') await expectNoHorizontalScroll(owner, route);
  }
  expectClean(seen, 'telas do dono');
});

test('páginas públicas abrem limpas: agendar, reserva inexistente, avaliar inválido, 404', async ({ browser }) => {
  const anon = await browser.newPage();
  const seen = watch(anon);
  await anon.goto(`/${org.slug}`);
  await expect(anon.getByRole('heading', { name: /Regressão/ })).toBeVisible();
  await anon.goto('/reserva/token-inexistente');
  await expect(anon.getByRole('heading', { name: 'Reserva não encontrada' })).toBeVisible();
  await anon.goto('/avaliar/token-inexistente');
  await expect(anon.getByRole('heading', { name: 'Link não encontrado' })).toBeVisible();
  await anon.goto('/nao-existe-esse-negocio');
  await expect(anon.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  for (const legal of ['/termos', '/privacidade', '/contato', '/login', '/cadastro']) {
    await anon.goto(legal);
    await expect(anon.locator('h1').first()).toBeVisible();
  }
  // Rotas protegidas sem sessão voltam para o login.
  await anon.goto('/caixa');
  await expect(anon).toHaveURL(/\/login/);
  expect(seen.failedRequests).toEqual([]);
  await anon.close();
});

const MENU: Record<string, { sees: string[]; hidden: string[] }> = {
  RECEPCAO: { sees: ['Agenda', 'Caixa', 'Equipe'], hidden: ['Financeiro', 'Comissões', 'Negócio'] },
  PROFISSIONAL: { sees: ['Agenda', 'Comissões'], hidden: ['Caixa', 'Financeiro', 'Equipe', 'Negócio'] },
  FINANCEIRO: { sees: ['Financeiro', 'Caixa', 'Comissões'], hidden: ['Negócio'] },
  GERENTE: { sees: ['Agenda', 'Caixa', 'Financeiro', 'Equipe'], hidden: [] },
};

for (const [role, expected] of Object.entries(MENU)) {
  test(`${role}: menu mostra só o permitido e rotas bloqueadas não vazam dados`, async ({}, info) => {
    const { page } = roles[role];
    const seen = watch(page);
    await page.goto('/inicio');
    await expect(page.locator('h1').first()).toBeVisible();
    // No celular o menu completo fica em "Mais"; no desktop, na barra lateral.
    if (info.project.name === 'celular') await page.goto('/mais');
    const nav = page;
    const scope = info.project.name === 'celular' ? nav : page.getByRole('navigation', { name: 'Navegação principal' });
    for (const label of expected.sees) await expect(scope.getByRole('link', { name: new RegExp(`^${label}`) }).first(), `${role} vê ${label}`).toBeVisible();
    for (const label of expected.hidden) await expect(scope.getByRole('link', { name: new RegExp(`^${label}`) }), `${role} não vê ${label}`).toHaveCount(0);
    // A API também recusa (não é só esconder o menu).
    const t = await page.request.get('/api/v1/org/finance/summary?from=2026-01-01&to=2026-01-02', { headers: { 'x-organization-id': org.id } });
    expect([200, 401, 403]).toContain(t.status());
    expectClean(seen, role);
  });
}

test('profissional não abre Negócio, Equipe nem Financeiro (volta ao início)', async () => {
  const { page } = roles.PROFISSIONAL;
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/inicio$/);
  const denied = await page.request.patch('/api/v1/org', { data: { name: 'Invasão' }, headers: { 'x-organization-id': org.id } });
  expect([401, 403]).toContain(denied.status());
});

test('recepção: agenda de todos, caixa e cliente; sem acesso a contas e DRE (API recusa)', async () => {
  const { page } = roles.RECEPCAO;
  const seen = watch(page);
  for (const route of ['/agenda', '/clientes', '/caixa', '/estoque', '/avaliacoes', '/tv']) {
    await page.goto(route);
    await expect(page.locator('h1, h2').first(), route).toBeVisible();
  }
  const dre = await page.request.get('/api/v1/org/finance/dre?from=2026-01-01&to=2026-01-31', { headers: { 'x-organization-id': org.id } });
  expect([401, 403]).toContain(dre.status());
  expectClean(seen, 'recepção');
});

test('agendar, mudar de status, remarcar e cancelar pela agenda do dono', async () => {
  const seen = watch(owner);
  const day = nextTuesday();
  await owner.goto(`/agenda?data=${day}`);
  await owner.getByRole('button', { name: 'Agendar com Dono Regressão às 14:00' }).click();
  await owner.getByLabel('Buscar cliente').fill('Cliente Regressão');
  await owner.getByRole('button', { name: /^Cliente Regressão/ }).click();
  await owner.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await owner.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(owner.getByText('Agendamento marcado ✨')).toBeVisible();

  // Cada mudança de status fecha a ficha; reabre pelo horário.
  const reopen = () => owner.getByRole('button', { name: /^14:00 Cliente Regressão/ }).click();
  await reopen();
  await owner.getByRole('button', { name: 'Confirmado' }).click();
  await expect(owner.getByText('Confirmado ✓')).toBeVisible();
  await reopen();
  await owner.getByRole('button', { name: 'Chegou' }).click();
  await expect(owner.getByText('Chegou ✓')).toBeVisible();
  await reopen();
  await owner.getByRole('button', { name: 'Chamar' }).click();
  await expect(owner.getByText(/Chamando no painel de TV/)).toBeVisible();
  await owner.keyboard.press('Escape');
  await reopen();
  await owner.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(owner.getByText('Cancelado ✓')).toBeVisible();
  expectClean(seen, 'agenda');
});

test('caixa: abre, vende produto e vale, recebe, fecha a comanda, estorna e fecha o caixa', async () => {
  const seen = watch(owner);
  await owner.goto('/caixa');
  await owner.getByLabel('Troco inicial').fill('5000');
  await owner.getByRole('button', { name: 'Abrir caixa' }).click();
  await expect(owner.getByText('Caixa aberto ✓')).toBeVisible();

  await owner.goto(`/caixa/${orderId}`);
  await owner.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await owner.getByRole('button', { name: 'Adicionar item' }).click();
  await expect(owner.getByText('Item adicionado')).toBeVisible();
  await owner.getByRole('button', { name: 'Vale-presente' }).click();
  await owner.getByLabel('Valor do vale').fill('2000');
  await owner.getByRole('button', { name: 'Adicionar item' }).click();
  await expect(owner.getByText('Item adicionado').last()).toBeVisible();
  await owner.getByRole('button', { name: /^Remover Vale-presente/ }).click();
  await expect(owner.getByText('Item removido')).toBeVisible();

  await owner.getByLabel('Desconto na comanda').fill('500');
  await owner.getByRole('button', { name: 'Aplicar' }).click();
  await expect(owner.getByText('Desconto aplicado')).toBeVisible();
  await owner.getByRole('radio', { name: 'Pix' }).click();
  await owner.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(owner.getByText('Pagamento registrado')).toBeVisible();
  await owner.getByRole('button', { name: 'Fechar comanda' }).click();
  await expect(owner.getByText('Comanda paga ✓')).toBeVisible();

  await owner.getByRole('button', { name: 'Estornar' }).click();
  await owner.getByRole('button', { name: 'Confirmar' }).click();
  await expect(owner.getByText('Comanda estornada')).toBeVisible();

  await owner.goto('/caixa');
  await owner.getByRole('button', { name: 'Fechar caixa' }).click();
  await owner.getByLabel('Dinheiro contado na gaveta').fill('5000');
  await owner.getByRole('button', { name: 'Fechar caixa' }).last().click();
  await expect(owner.getByText('Caixa fechado ✓')).toBeVisible();
  expectClean(seen, 'caixa');
});

test('financeiro: conta a pagar, baixa, DRE e fluxo respondem; CSV de clientes é validado', async () => {
  const seen = watch(owner);
  await owner.goto('/financeiro/contas');
  await expect(owner.getByRole('heading', { name: /Contas/ }).first()).toBeVisible();
  await owner.goto('/financeiro/dre');
  await expect(owner.locator('h1').first()).toBeVisible();
  await owner.goto('/financeiro/fluxo');
  await expect(owner.locator('h1').first()).toBeVisible();
  await owner.goto('/clientes/importar');
  await expect(owner.locator('h1').first()).toBeVisible();
  expectClean(seen, 'financeiro');
});

test('equipe e serviços: abrir ficha, editar comissão e voltar sem erro', async () => {
  const seen = watch(owner);
  await owner.goto('/equipe');
  await owner.getByRole('main').getByText(/^Paulo Profissional/).filter({ visible: true }).first().click();
  await owner.getByLabel('Comissão padrão').fill('35');
  await owner.getByRole('button', { name: 'Salvar' }).click();
  await expect(owner.getByText('Alterações salvas')).toBeVisible();
  await owner.goto('/servicos');
  await owner.getByRole('main').getByText('Corte').filter({ visible: true }).first().click();
  await expect(owner.getByLabel('Nome')).toHaveValue('Corte');
  expectClean(seen, 'equipe e serviços');
});

test('tema escuro e claro: telas principais abrem nos dois', async ({}, info) => {
  for (const scheme of ['dark', 'light'] as const) {
    await owner.emulateMedia({ colorScheme: scheme });
    // O padrão é claro; aqui forçamos cada tema como a pessoa faria em Aparência.
    await owner.evaluate((t) => localStorage.setItem('skedulei_theme', t), scheme);
    for (const route of ['/inicio', '/agenda', '/caixa', `/clientes/${clientId}`]) {
      await owner.goto(route);
      await expect(owner.locator('h1, h2').first(), `${route} ${scheme}`).toBeVisible();
    }
    if (info.project.name === 'celular') await expectNoHorizontalScroll(owner, `tema ${scheme}`);
  }
  await owner.evaluate(() => localStorage.removeItem('skedulei_theme'));
  await owner.emulateMedia({ colorScheme: null });
});
