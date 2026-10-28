import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, watch } from './helpers';

const stamp = `rl${Date.now().toString(36)}`;

test('relatórios: indicadores, períodos, clientes sem voltar e aniversariantes', async ({ page, context }) => {
  const seen = watch(page);
  const org = await createBusiness(context, stamp);
  const headers = { authorization: `Bearer ${org.owner.token}`, 'x-organization-id': org.id };
  const soon = new Date(Date.now() + 2 * 86_400_000);
  const birth = `1990-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await context.request.post('/api/v1/org/clients', { headers, data: { name: 'Gabi Aniversário', phone: '11977778888', birthDate: birth } });

  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  for (const kpi of ['Atendimentos', 'Ticket médio', 'Faltas', 'Cancelamentos', 'Ocupação da agenda', 'Clientes atendidos', 'Clientes que voltaram', 'Reservas online']) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Este mês' }).click();
  await expect(page.getByRole('button', { name: 'Este mês' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Nenhum atendimento concluído no período.')).toBeVisible();

  // Sem voltar: ninguém ainda; com prazo maior segue vazio.
  await expect(page.getByText('Ninguém sumido')).toBeVisible();
  await page.getByRole('button', { name: '180+ dias' }).click();
  await expect(page.getByText('Ninguém sumido')).toBeVisible();

  // Aniversariante com botão de WhatsApp (mensagem pronta).
  const birthdays = page.getByRole('region', { name: 'Aniversariantes' });
  await expect(birthdays.getByText('Gabi Aniversário')).toBeVisible();
  const link = birthdays.getByRole('link', { name: 'Dar parabéns a Gabi Aniversário no WhatsApp' });
  await expect(link).toHaveAttribute('href', /wa\.me\/5511977778888\?text=/);
  if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'relatórios');
  expectClean(seen, 'relatórios');
});
