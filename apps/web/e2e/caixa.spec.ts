import { expect, test, type Page } from '@playwright/test';

/**
 * Caixa de ponta a ponta, no celular e no desktop:
 * comissão do profissional → atendimento na agenda → "Abrir comanda" → abrir caixa →
 * receber em dinheiro com troco → fechar comanda → comissão e fechamento → conferência do caixa → financeiro.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let orderUrl = '';

function nextTuesday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const DAY = nextTuesday();

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  const stamp = `${info.project.name}-${Date.now()}`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Zé Caixa');
  await page.getByLabel('E-mail').fill(`ze-caixa+${stamp}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByLabel('Confirmar senha').fill('senha-forte-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: /Barbearia/ }).click();
  await page.getByLabel('Nome do negócio').fill(`Barbearia Caixa ${stamp}`);
  for (const step of ['Horário de funcionamento', /Serviços que você oferece/, 'Sua equipe', 'Módulos']) {
    await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
    await expect(page.getByRole('heading', { name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Criar meu negócio' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
});

test.afterAll(async () => {
  await page.close();
});

test('comissão padrão de 40% no profissional', async () => {
  await page.goto('/equipe');
  // Celular: lista de botões; desktop: linha da tabela (clicável).
  await page.getByRole('main').getByText(/^Zé Caixa/).filter({ visible: true }).first().click();
  await page.getByLabel('Comissão padrão').fill('40');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Alterações salvas')).toBeVisible();
});

test('do atendimento à comanda; caixa fechado avisa e leva a abrir', async () => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole('button', { name: 'Agendar com Zé Caixa às 10:00' }).click();
  await page.getByLabel('Buscar cliente').fill('Cliente Caixa');
  await page.getByRole('button', { name: 'Cadastrar “Cliente Caixa”' }).click();
  await page.getByLabel('Serviço', { exact: true }).selectOption({ label: 'Corte · 40 min · R$ 50,00' });
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByText('Horário marcado ✨')).toBeVisible();

  await page.getByRole('button', { name: /^10:00 Cliente Caixa/ }).click();
  await page.getByRole('button', { name: 'Abrir comanda' }).click();
  await expect(page).toHaveURL(/\/caixa\/[0-9a-f-]{36}$/);
  orderUrl = page.url();
  await expect(page.getByRole('heading', { name: 'Comanda #1' })).toBeVisible();
  await expect(page.getByText('O caixa está fechado')).toBeVisible();

  await page.getByRole('link', { name: 'Abrir caixa' }).click();
  await page.getByLabel('Troco inicial').fill('5000');
  await page.getByRole('button', { name: 'Abrir caixa' }).click();
  await expect(page.getByText('Caixa aberto ✓')).toBeVisible();
});

test('recebe em dinheiro com troco e fecha a comanda', async () => {
  await page.goto(orderUrl);
  await page.getByRole('radio', { name: 'Dinheiro' }).click();
  await page.getByLabel('Recebido em dinheiro').fill('10000');
  await expect(page.getByText('Troco: R$ 50,00')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(page.getByText('Troco: R$ 50,00').last()).toBeVisible();
  await page.getByRole('button', { name: 'Fechar comanda' }).click();
  await expect(page.getByText('Comanda paga ✓')).toBeVisible();
  await expect(page.getByText('Paga', { exact: true })).toBeVisible();
});

test('comissão de 40% e fechamento do profissional', async () => {
  await page.goto('/comissoes');
  await expect(page.getByText('A pagar').filter({ visible: true }).first().locator('..')).toContainText('R$ 20,00');
  await page.getByRole('button', { name: 'Fechar e pagar' }).click();
  await page.getByRole('button', { name: /Confirmar (pagamento de )?R\$ 20,00/ }).click();
  await expect(page.getByText(/Fechamento de Zé Caixa registrado/)).toBeVisible();
  await expect(page.getByText('Nada em aberto')).toBeVisible();
});

test('conferência e fechamento do caixa', async () => {
  await page.goto('/caixa');
  await expect(page.getByText('Esperado na gaveta').locator('..')).toContainText('R$ 100,00');
  await page.getByRole('button', { name: 'Fechar caixa' }).click();
  await page.getByLabel('Dinheiro contado na gaveta').fill('10000');
  await expect(page.getByText('Bateu certinho ✓')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar caixa' }).last().click();
  await expect(page.getByText('Caixa fechado ✓')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir caixa' })).toBeVisible();
});

test('financeiro mostra o dia', async () => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await expect(page.getByRole('main').getByText('Faturamento', { exact: true }).locator('..')).toContainText('R$ 50,00');
  await expect(page.getByRole('main').getByText('Comissões', { exact: true }).locator('..')).toContainText('R$ 20,00');
});
