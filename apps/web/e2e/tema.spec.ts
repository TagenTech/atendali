import { expect, test } from '@playwright/test';

const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('tema: abre claro por padrão', () => {
  test.use({ colorScheme: 'dark' });

  test('mesmo com o aparelho no escuro, quem nunca escolheu vê o tema claro', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bg(page)).toBe('rgb(251, 248, 255)');
  });

  test('quem escolheu escuro ou automático continua com a escolha', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('agendei_theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.evaluate(() => localStorage.setItem('agendei_theme', 'system'));
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await bg(page)).toBe('rgb(23, 19, 31)');
  });
});
