import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, nextTuesday, watch, type SeededOrg } from './helpers';

const stamp = `mr${Date.now().toString(36)}`;
const DAY = nextTuesday();
const [, MM, DD] = DAY.split('-');
const later = (() => {
  const d = new Date(`${DAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(5, 10).split('-').reverse(); // [DD, MM]
})();
const EMAIL = `mae+${stamp}@skedulei.test`;
const PHONE = '11988887777';

let org: SeededOrg;

test.describe('responsável × paciente e Minhas reservas', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    org = await createBusiness(ctx, stamp, 'CLINICA_MEDICA');
    await ctx.close();
  });

  const outboxCode = async (page: import('@playwright/test').Page) => {
    let code = '';
    await expect
      .poll(async () => {
        const box = (await (await page.request.get('/api/v1/dev/outbox')).json()) as { to: string; code?: string }[];
        code = box.find((m) => m.to === EMAIL && m.code)?.code ?? '';
        return code;
      })
      .toMatch(/^\d{6}$/);
    return code;
  };

  test('a mãe marca para a filha, revê, remarca e cancela sem ter conta', async ({ page }) => {
    const seen = watch(page);
    await page.goto(`/${org.slug}`);
    await page.getByRole('button', { name: /^Corte R\$/ }).click();
    await page.getByRole('button', { name: 'Qualquer pessoa' }).click();
    await page.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
    await page.getByRole('button', { name: '11:00', exact: true }).click();

    // Para quem é: outra pessoa → pede o paciente e o parentesco.
    await page.getByRole('radio', { name: /Para outro paciente/ }).click();
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Informe o nome do paciente' })).toBeVisible();
    await page.getByLabel('Nome do paciente').fill('Sofia Costa');
    await page.getByLabel('Nascimento (opcional)').fill('2021-03-10');
    await page.getByLabel('Seu parentesco').selectOption('MAE');
    await page.getByLabel('Seu nome (quem está marcando)').fill('Mariana Costa');
    await page.getByLabel('Celular (WhatsApp)').fill(PHONE);
    await page.getByLabel('E-mail (recomendado)').fill(EMAIL);
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();

    await expect(page).toHaveURL(/\/reserva\/[\w-]+$/);
    await expect(page.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();
    await expect(page.getByText('Atendimento de').locator('strong')).toHaveText('Sofia Costa');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Adicionar ao calendário' }).click();
    expect((await download).suggestedFilename()).toBe('reserva.ics');

    // Fechou a aba e voltou: a reserva continua à vista neste aparelho.
    await page.goto(`/${org.slug}`);
    await expect(page.getByRole('region', { name: 'Suas reservas neste aparelho' })).toContainText('Sofia Costa');

    // Minhas reservas: celular → código no e-mail → reservas.
    await page.getByRole('link', { name: 'Minhas reservas' }).click();
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByText('Informe o celular com DDD')).toBeVisible();
    await page.getByLabel('Celular (WhatsApp)').fill(PHONE);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByRole('status')).toContainText('o código já está a caminho');
    await page.getByLabel('Código de 6 números').fill('000000');
    await page.getByRole('button', { name: 'Ver minhas reservas' }).click();
    await expect(page.getByText(/Código inválido ou expirado/)).toBeVisible();
    await page.getByLabel('Código de 6 números').fill(await outboxCode(page));
    await page.getByRole('button', { name: 'Ver minhas reservas' }).click();
    await expect(page.getByText('Sofia Costa', { exact: true })).toBeVisible();

    // Remarcar para a semana seguinte.
    await page.getByRole('button', { name: /^Remarcar Sofia Costa/ }).click();
    await page.getByRole('button', { name: `Novo dia ${later[0]}/${later[1]}` }).click();
    await page.getByRole('button', { name: 'Novo horário 10:00' }).click();
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
    await expect(page.getByText('Horário remarcado ✓')).toBeVisible();
    await expect(page.getByText(/às 10:00/)).toBeVisible();

    // Cancelar.
    await page.getByRole('button', { name: /^Cancelar Sofia Costa/ }).click();
    await page.getByRole('button', { name: /^Confirmar cancelamento de Sofia Costa/ }).click();
    await expect(page.getByText('Nenhuma reserva por vir nesse celular.')).toBeVisible();
    if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'minhas reservas');
    expectClean(seen, 'minhas reservas');
  });

  test('a clínica vê a paciente com o responsável e os outros pacientes do mesmo telefone', async ({ browser }) => {
    // Clínica com sessão aberta (cadastro pela API não gasta o limite de logins) e dois filhos com o mesmo telefone.
    const ctx = await browser.newContext();
    const clinic = await createBusiness(ctx, `${stamp}c`, 'CLINICA_MEDICA');
    const pub = await (await ctx.request.get(`/api/v1/public/orgs/${clinic.slug}`)).json();
    const serviceId = pub.services[0].id as string;
    const slots = await (await ctx.request.get(`/api/v1/public/orgs/${clinic.slug}/slots?date=${DAY}&serviceId=${serviceId}`)).json();
    const times = [slots.slots[2].startsAt, slots.slots[6].startsAt] as string[];
    for (const [i, patientName] of ['Davi Costa', 'Alice Costa'].entries()) {
      const r = await ctx.request.post(`/api/v1/public/orgs/${clinic.slug}/bookings`, { data: { serviceId, startsAt: times[i], name: 'Mariana Costa', phone: '11955554444', patientName, relationship: 'MAE' } });
      expect(r.status()).toBe(201);
    }
    const owner = await ctx.newPage();
    await owner.goto('/clientes');
    await owner.getByLabel(/^Buscar/).first().fill('Davi');
    await expect(owner.getByText('Resp.: Mariana Costa').filter({ visible: true }).first()).toBeVisible();
    await owner.getByRole('link', { name: /Davi Costa/ }).filter({ visible: true }).first().click();
    await expect(owner.getByText('Responsável:')).toContainText('Mariana Costa');
    await expect(owner.getByText('Mesmo telefone')).toBeVisible();
    await expect(owner.getByRole('link', { name: 'Alice Costa' })).toBeVisible();
    await ctx.close();
  });

  test('a opção de cobrar taxa de agendamento existe, mas fica desligada ("em breve")', async ({ page, context }) => {
    const o = await createBusiness(context, `${stamp}fee`);
    expect(o.id).toBeTruthy();
    await page.goto('/configuracoes');
    const fee = page.getByRole('switch', { name: /Cobrar taxa de agendamento/ });
    await expect(fee).toBeVisible();
    await expect(fee).toBeDisabled();
    await expect(page.getByText('Em breve').first()).toBeVisible();
  });
});
