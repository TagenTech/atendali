import { expect, test, type Page } from '@playwright/test';

/**
 * Os fluxos principais, no celular e no desktop:
 * criar conta → onboarding (barbearia) → início → novo serviço → pessoa na equipe → sair e entrar.
 * Uma conta nova por projeto; os passos rodam em ordem na mesma aba.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let dona: { name: string; email: string; password: string };

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  dona = { name: 'Zé Playwright', email: `ze+${info.project.name}-${Date.now()}@skedulei.test`, password: 'senha-forte-123' };
});

test.afterAll(async () => {
  await page.close();
});

test('cria a conta e cai no onboarding', async () => {
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill(dona.name);
  await page.getByLabel('E-mail').fill(dona.email);
  await page.getByLabel('Senha', { exact: true }).fill(dona.password);
  await page.getByLabel('Confirmar senha').fill(dona.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: /Bem-vindo\(a\), Zé/ })).toBeVisible();
});

test('onboarding: barbearia com horário, serviços e uma pessoa sem acesso', async () => {
  await page.getByRole('button', { name: /Barbearia/ }).click();

  // Sem nome não avança.
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Informe o nome do negócio' })).toBeVisible();
  await page.getByLabel('Nome do negócio').fill('Barbearia do Zé');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Horário: fecha o sábado.
  await expect(page.getByRole('heading', { name: 'Horário de funcionamento' })).toBeVisible();
  await page.getByRole('switch', { name: 'Sábado: aberto' }).click();
  await expect(page.getByRole('switch', { name: 'Sábado: fechado' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Serviços de exemplo da barbearia; tira a pigmentação.
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true }).first()).toHaveValue('Corte');
  await page.getByRole('checkbox', { name: 'Incluir Pigmentação' }).uncheck();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Equipe: barbeiro sem e-mail (só agenda).
  await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Beto Barbeiro');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Módulos' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Clube de assinatura/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Criar meu negócio' }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: /Boa (noite|tarde|dia), Zé/ })).toBeVisible();
});

test('serviços: lista os do onboarding e cadastra um novo', async () => {
  await page.goto('/servicos');
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();
  await expect(page.getByText('Corte + barba').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Pigmentação')).toHaveCount(0);

  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Sobrancelha');
  await page.getByRole('button', { name: '30 min', exact: true }).click();
  await page.getByLabel('Preço').fill('2500');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Serviço criado ✨')).toBeVisible();
  await expect(page.getByText('R$ 25,00').filter({ visible: true }).first()).toBeVisible();
});

test('equipe: dono, barbeiro sem acesso e convite para a recepção', async () => {
  await page.goto('/equipe');
  await expect(page.getByText('Beto Barbeiro').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Sem acesso ao app').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Rita Recepção');
  await page.getByLabel('E-mail').fill(`rita+${Date.now()}@skedulei.test`);
  await page.getByRole('radio', { name: /Recepção/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/Convite enviado para/)).toBeVisible();
  await expect(page.getByText('Convite enviado').filter({ visible: true }).first()).toBeVisible();
});

test('sai e entra de novo, direto no negócio', async () => {
  await page.goto('/mais');
  // No desktop a barra lateral também tem "Sair"; o da tela Mais é o último.
  await page.getByRole('button', { name: /^Sair/ }).last().click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('E-mail').fill(dona.email);
  await page.getByLabel('Senha', { exact: true }).fill(dona.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('main').getByText('Barbearia do Zé')).toBeVisible();
});
