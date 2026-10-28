import { expect, test } from '@playwright/test';
import { createBusiness } from './helpers';

let n = 0;
const stamp = () => `fe${Date.now().toString(36)}${n++}`;

test.describe('formulários do app: erro embaixo do campo', () => {
  // Cadastro pela API deixa a sessão no contexto (não gasta o limite de logins).
  test.beforeEach(async ({ page }) => {
    await createBusiness(page.context(), stamp());
  });

  test('nova conta a pagar', async ({ page }) => {
    await page.goto('/financeiro/contas');
    await page.getByRole('button', { name: /nova conta|conta a pagar/i }).first().click();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('Descreva a conta')).toBeVisible();
    await expect(page.getByText('Informe o valor')).toBeVisible();
    await expect(page.getByLabel('Descrição')).toBeFocused();
    await page.getByLabel('Descrição').fill('Aluguel');
    await expect(page.getByText('Descreva a conta')).toHaveCount(0);
  });

  test('bloquear horário: fim antes do início', async ({ page }) => {
    await page.goto('/agenda');
    await page.getByRole('button', { name: /bloquear/i }).first().click();
    await page.locator('#bl-start').fill('14:00');
    await page.locator('#bl-end').fill('13:00');
    await page.getByRole('button', { name: 'Bloquear', exact: true }).click();
    await expect(page.getByText('O fim precisa ser depois do início')).toBeVisible();
  });

  test('registrar vale de comissão', async ({ page }) => {
    await page.goto('/comissoes');
    await page.getByRole('button', { name: /vale/i }).first().click();
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByText('Escolha a pessoa')).toBeVisible();
    await expect(page.getByText('Informe o valor')).toBeVisible();
  });
});
