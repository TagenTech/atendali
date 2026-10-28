import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, nextTuesday, watch, type SeededOrg } from './helpers';

const stamp = `ca${Date.now().toString(36)}`;
const DAY = nextTuesday();
const [, MM, DD] = DAY.split('-');
const later = (() => {
  const d = new Date(`${DAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(5, 10).split('-').reverse();
})();

let org: SeededOrg;

test.describe('carrinho de procedimentos', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    org = await createBusiness(ctx, stamp);
    await ctx.close();
  });

  const fill = async (page: import('@playwright/test').Page, phone: string, label: RegExp) => {
    await page.getByLabel('Seu nome').fill('Carla Cliente');
    await page.getByLabel('Celular (WhatsApp)').fill(phone);
    await page.getByLabel('E-mail (recomendado)').fill(`carla+${stamp}${phone.slice(-4)}@skedulei.test`);
    await page.getByRole('button', { name: label }).click();
  };

  test('dois procedimentos, um logo após o outro, com um link só', async ({ page }) => {
    const seen = watch(page);
    await page.goto(`/${org.slug}`);
    await page.getByRole('button', { name: /^Corte R\$/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Como encaixar' })).toHaveCount(0); // com um só, fluxo de sempre
    await page.getByRole('button', { name: /^Barba R\$/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Como encaixar' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Procedimentos escolhidos' })).toContainText('2. Barba');

    await expect(page.getByRole('radio', { name: /Um logo após o outro/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
    await page.getByRole('button', { name: 'Começar às 11:00' }).click();
    await expect(page.getByRole('list', { name: 'Ordem dos procedimentos' })).toContainText('11:00');
    await expect(page.getByRole('list', { name: 'Ordem dos procedimentos' })).toContainText('11:40'); // Corte 40 min → Barba logo depois
    await fill(page, '11988881111', /^Confirmar 2 /);

    await expect(page).toHaveURL(/\/reserva\/[\w-]+$/);
    await expect(page.getByRole('heading', { name: 'Horários marcados! 🎉' })).toBeVisible();
    await expect(page.getByText('Corte', { exact: true })).toBeVisible();
    await expect(page.getByText('Barba', { exact: true })).toBeVisible();
    if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'reserva com 2 itens');

    // Cancelar só a barba; o corte continua.
    await page.getByRole('button', { name: 'Cancelar Barba' }).click();
    await page.getByRole('button', { name: 'Confirmar cancelamento de Barba' }).click();
    await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Horários marcados! 🎉' })).toBeVisible();
    expectClean(seen, 'carrinho em sequência');
  });

  test('horários separados: não deixa dois no mesmo horário; remarca um e cancela tudo', async ({ page }) => {
    await page.goto(`/${org.slug}`);
    await page.getByRole('button', { name: /^Corte R\$/ }).click();
    await page.getByRole('button', { name: /^Barba R\$/ }).click();
    await page.getByRole('radio', { name: /Escolher o horário de cada um/ }).click();

    const corte = page.getByRole('region', { name: 'Horário de Corte' });
    const barba = page.getByRole('region', { name: 'Horário de Barba' });
    await corte.getByRole('button', { name: `Dia de Corte ${DD}/${MM}` }).click();
    await corte.getByRole('button', { name: 'Corte às 14:00' }).click();
    await barba.getByRole('button', { name: `Dia de Barba ${DD}/${MM}` }).click();
    // 14:00 já é do corte: a barba não oferece horário que bata com ele.
    await expect(barba.getByRole('button', { name: 'Barba às 14:00' })).toHaveCount(0);
    await expect(barba.getByRole('button', { name: 'Barba às 14:15' })).toHaveCount(0);
    await barba.getByRole('button', { name: 'Barba às 16:00' }).click();
    await fill(page, '11988882222', /^Confirmar 2 /);

    await expect(page.getByRole('heading', { name: 'Horários marcados! 🎉' })).toBeVisible();
    await page.getByRole('button', { name: 'Remarcar Barba' }).click();
    await page.getByRole('button', { name: `Novo dia ${later[0]}/${later[1]}` }).click();
    await page.getByRole('button', { name: 'Novo horário 10:00' }).click();
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
    await expect(page.getByText('Horário remarcado ✓')).toBeVisible();
    await expect(page.getByText(/às 10:00/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar tudo' }).click();
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
    await expect(page.getByRole('heading', { name: 'Horários cancelados' })).toBeVisible();
  });
});
