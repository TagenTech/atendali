import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, watch } from './helpers';

/** Página comercial na raiz: visitante vê a apresentação; quem já tem sessão cai direto no app. */
test('visitante vê a página comercial, limpa, com os caminhos de entrada e perguntas que abrem', async ({ browser }, info) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Marcado.');
  await expect(page.getByRole('link', { name: /Criar conta/ }).first()).toHaveAttribute('href', '/cadastro');
  await expect(page.getByRole('link', { name: 'Entrar', exact: true }).first()).toHaveAttribute('href', '/login');
  for (const heading of [/três passos/, /jeito de cada negócio/, /dia a dia pede/, /Perguntas frequentes/]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  const pergunta = page.getByText('Meu cliente precisa instalar algo para marcar?');
  await pergunta.click();
  await expect(page.getByText(/A página de agendamento abre no navegador/)).toBeVisible();
  for (const [name, href] of [['Termos de uso', '/termos'], ['Privacidade', '/privacidade'], ['Contato', '/contato']] as const) {
    await expect(page.getByRole('navigation', { name: 'Rodapé' }).getByRole('link', { name })).toHaveAttribute('href', href);
  }
  if (info.project.name === 'celular') await expectNoHorizontalScroll(page, '/');
  expectClean(seen, 'página comercial');
  await page.close();
});

test('quem já tem sessão vai direto para o app', async ({ browser }) => {
  const ctx = await browser.newContext();
  await createBusiness(ctx, `landing-${Date.now()}`);
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/inicio$/);
  await ctx.close();
});
