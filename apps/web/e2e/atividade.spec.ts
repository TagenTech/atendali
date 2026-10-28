import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, watch } from './helpers';

const stamp = `at${Date.now().toString(36)}`;

test('atividade: o dono vê quem estornou, deu desconto e mexeu no caixa', async ({ page, context }) => {
  const seen = watch(page);
  const org = await createBusiness(context, stamp);
  const headers = { authorization: `Bearer ${org.owner.token}`, 'x-organization-id': org.id };
  const api = context.request;
  await api.post('/api/v1/org/cash/open', { headers, data: { openingCents: 5000 } });
  const order = await (await api.post('/api/v1/org/orders', { headers, data: {} })).json();
  await api.post(`/api/v1/org/orders/${order.id}/items`, { headers, data: { kind: 'AVULSO', description: 'Hidratação', unitPriceCents: 9000 } });
  await api.patch(`/api/v1/org/orders/${order.id}`, { headers, data: { discountCents: 2000 } });
  await api.post(`/api/v1/org/orders/${order.id}/cancel`, { headers });
  await api.post('/api/v1/org/cash/movements', { headers, data: { kind: 'SANGRIA', amountCents: 1000, note: 'Depósito' } });

  // No celular o caminho é Mais → Atividade (e Relatórios).
  if (test.info().project.name === 'celular') {
    await page.goto('/mais');
    await expect(page.getByRole('link', { name: /^Relatórios/ })).toBeVisible();
    await page.getByRole('link', { name: /^Atividade/ }).click();
    await expect(page).toHaveURL(/\/atividade$/);
  }
  await page.goto('/atividade');
  await expect(page.getByRole('heading', { name: 'Atividade' })).toBeVisible();
  await expect(page.getByText(/Desconto da comanda #1: de R\$\s*0,00 para R\$\s*20,00/)).toBeVisible();
  await expect(page.getByText(/Comanda #1 cancelada/)).toBeVisible();
  await expect(page.getByText(/Sangria de R\$\s*10,00 — Depósito/)).toBeVisible();
  await expect(page.getByText('Dono Regressão').filter({ visible: true }).first()).toBeVisible();

  // Filtro por grupo.
  await page.getByRole('button', { name: 'Caixa', exact: true }).click();
  await expect(page.getByText(/Sangria de R\$\s*10,00/)).toBeVisible();
  await expect(page.getByText(/Desconto da comanda/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Tudo', exact: true }).click();
  await expect(page.getByText(/Desconto da comanda/)).toBeVisible();
  if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'atividade');
  expectClean(seen, 'atividade');
});
