import { expect, test } from '@playwright/test';
import { signReminderLink } from '../../api/src/agenda/reminder-link';
import { EXTERNAL_RUN, createBusiness, nextTuesday } from './helpers';

const stamp = `lb${Date.now().toString(36)}`;
const JWT_SECRET = 'playwright-secret-playwright-secret-0001'; // o mesmo do playwright.config.ts
const DAY = nextTuesday();

test.describe('lembretes', () => {
  test('o link do lembrete abre a reserva e o cliente confirma a presença', async ({ page, context }) => {
    test.skip(EXTERNAL_RUN, 'o link assinado usa o JWT_SECRET da API de teste local');
    const org = await createBusiness(context, stamp);
    const pub = await (await page.request.get(`/api/v1/public/orgs/${org.slug}`)).json();
    const serviceId = pub.services[0].id as string;
    const slots = await (await page.request.get(`/api/v1/public/orgs/${org.slug}/slots?date=${DAY}&serviceId=${serviceId}`)).json();
    const booked = await page.request.post(`/api/v1/public/orgs/${org.slug}/bookings`, {
      data: { serviceId, startsAt: slots.slots[3].startsAt, name: 'Ana Souza', phone: '11911112222', email: `ana+${stamp}@skedulei.test` },
    });
    expect(booked.status()).toBe(201);
    const { token } = await booked.json();
    const group = await (await page.request.get(`/api/v1/public/bookings/${token}/group`)).json();
    const signed = signReminderLink(JWT_SECRET, group.items[0].id, Date.now() + 86_400_000);

    await page.goto(`/reserva/${signed}`);
    await expect(page.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();
    await expect(page.getByText('Agendado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar presença' }).click();
    await expect(page.getByText('Presença confirmada ✓')).toBeVisible();
    await expect(page.getByText('Confirmado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar presença' })).toHaveCount(0);
    // Remarcar e cancelar continuam pelo mesmo link.
    await expect(page.getByRole('button', { name: 'Remarcar' })).toBeVisible();
    // Link adulterado não abre nada.
    await page.goto(`/reserva/${signed.slice(0, -3)}xyz`);
    await expect(page.getByRole('heading', { name: 'Reserva não encontrada' })).toBeVisible();
  });

  test('configurações: a chave de lembretes liga e desliga', async ({ page, context }) => {
    await createBusiness(context, `${stamp}b`);
    await page.goto('/configuracoes?aba=agendamento');
    const sw = page.getByRole('switch', { name: /Lembretes por e-mail/ });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.press('Space');
    await expect(page.getByText('Lembretes desligados')).toBeVisible();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByRole('switch', { name: /Lembretes por e-mail/ })).toHaveAttribute('aria-checked', 'false');
  });
});
