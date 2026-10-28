import { expect, test, type Page } from '@playwright/test';

/**
 * Contas a pagar/receber, DRE, fluxo de caixa e importação de clientes, no celular e no desktop.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  const stamp = `${info.project.name}-${Date.now()}`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Zé Contas');
  await page.getByLabel('E-mail').fill(`ze-contas+${stamp}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByLabel('Confirmar senha').fill('senha-forte-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: /Barbearia/ }).click();
  await page.getByLabel('Nome do negócio').fill(`Barbearia Contas ${stamp}`);
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

test('conta a pagar: cadastra, aparece no mês e é marcada como paga', async () => {
  await page.goto('/financeiro/contas');
  await expect(page.getByRole('heading', { name: 'Contas' })).toBeVisible();
  await page.getByRole('button', { name: 'Conta', exact: true }).click();
  await page.getByLabel('Descrição').fill('Aluguel da sala');
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Aluguel e condomínio' });
  await page.getByLabel('Valor').fill('120000');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText('Conta criada')).toBeVisible();

  const row = page.getByText('Aluguel da sala').filter({ visible: true }).first();
  await expect(row).toBeVisible();
  await expect(page.getByText('A pagar', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await row.click();
  await page.getByRole('button', { name: 'Marcar como paga' }).click();
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.getByText('Conta paga')).toBeVisible();
  await expect(page.getByText('Paga', { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('receita avulsa: lança e dá baixa', async () => {
  await page.goto('/financeiro/contas');
  await page.getByRole('button', { name: 'A receber' }).click();
  await page.getByRole('button', { name: 'Receita', exact: true }).click();
  await page.getByLabel('Descrição').fill('Aluguel de cadeira');
  await page.getByLabel('Valor').fill('50000');
  await page.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(page.getByText('Receita lançada')).toBeVisible();
  await page.getByText('Aluguel de cadeira').filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /Dar baixa/ }).click();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(page.getByText('Recebimento registrado')).toBeVisible();
});

test('plano de contas editável', async () => {
  await page.goto('/financeiro/contas');
  await page.getByRole('button', { name: 'Categorias' }).click();
  await expect(page.getByRole('heading', { name: 'Plano de contas' })).toBeVisible();
  await expect(page.getByLabel('Nome da categoria Aluguel e condomínio')).toBeVisible();
  await page.getByLabel('Nova categoria').fill('Cursos e treinamentos');
  await page.getByRole('button', { name: 'Incluir' }).click();
  await expect(page.getByText('Categoria incluída')).toBeVisible();
  await expect(page.getByLabel('Nome da categoria Cursos e treinamentos')).toBeVisible();
});

test('DRE mostra a despesa paga e o resultado', async () => {
  await page.goto('/financeiro/dre');
  await expect(page.getByRole('heading', { name: 'DRE' })).toBeVisible();
  const rows = page.getByRole('row');
  await expect(rows.filter({ hasText: 'Receita bruta' })).toContainText('R$ 500,00');
  await expect(rows.filter({ hasText: 'Despesas fixas' })).toContainText('1.200,00');
  await expect(rows.filter({ hasText: /^Resultado/ })).toContainText('700,00');
  await expect(page.getByRole('heading', { name: 'Despesas por categoria' })).toBeVisible();
  await expect(page.getByText('Aluguel e condomínio').filter({ visible: true }).first()).toBeVisible();
});

test('fluxo de caixa realizado e projetado', async () => {
  await page.goto('/financeiro/fluxo');
  await expect(page.getByRole('heading', { name: 'Fluxo de caixa' })).toBeVisible();
  await expect(page.getByText('Vai entrar')).toBeVisible();
  await page.getByRole('button', { name: '60 dias' }).click();
  await expect(page.getByRole('list', { name: /previsto para 60 dias/ })).toBeVisible();
  await page.getByRole('button', { name: 'Realizado' }).click();
  await expect(page.getByText('Entrou', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Fluxo de caixa realizado' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Fluxo de caixa realizado' })).toContainText('1.200,00');
});

test('importa clientes por CSV: pré-visualiza, ignora duplicado e erro', async () => {
  await page.goto('/clientes');
  await page.getByRole('link', { name: /Importar/ }).click();
  await expect(page).toHaveURL(/\/clientes\/importar$/);
  const csv = [
    'Nome;Celular;E-mail;Nascimento;Etiquetas',
    'Ana Importada;(11) 98888-7777;ana@x.com;05/03/1990;vip',
    'ana  importada;11988887777;;;',
    'Filha da Ana;11988887777;;;',
    'Beto Importado;11977776666;;;',
    'Sem celular válido;123;;;',
  ].join('\n');
  await page.getByLabel('Arquivo CSV').setInputFiles({ name: 'clientes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('status').filter({ hasText: '3 para importar' })).toContainText('1 já existem');
  await expect(page.getByRole('status').filter({ hasText: '3 para importar' })).toContainText('1 com erro');
  await page.getByRole('button', { name: 'Importar 3' }).click();
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Importação concluída' })).toContainText('3 importados');
  await page.getByRole('link', { name: /Ver /i }).click();
  await expect(page.getByText('Ana Importada').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Beto Importado').filter({ visible: true }).first()).toBeVisible();
  // Mesmo celular com nome diferente é outro paciente (irmãos), não duplicado.
  await expect(page.getByText('Filha da Ana').filter({ visible: true }).first()).toBeVisible();
});
