import { expect, test, type Page } from '@playwright/test';

/**
 * Agenda e agendamento online, no celular e no desktop:
 * negócio novo → agenda (clicar no horário, marcar, concluir) → ficha do cliente →
 * página pública (cliente marca sozinho) → link "minha reserva" (cancelar).
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let slug = '';

/** Próxima terça (7 a 13 dias à frente), no fuso de São Paulo. */
function nextTuesday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const DAY = nextTuesday();
const [, MM, DD] = DAY.split('-');

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  const stamp = `${info.project.name}-${Date.now()}`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Zé Agenda');
  await page.getByLabel('E-mail').fill(`ze-agenda+${stamp}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByLabel('Confirmar senha').fill('senha-forte-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('button', { name: /Barbearia/ }).click();
  await page.getByLabel('Nome do negócio').fill(`Barbearia ${stamp}`);
  for (const step of ['Horário de funcionamento', /Serviços que você oferece/, 'Sua equipe', 'Módulos']) {
    await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
    await expect(page.getByRole('heading', { name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Criar meu negócio' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  slug = `barbearia-${stamp}`.toLowerCase();
});

test.afterAll(async () => {
  await page.close();
});

test('agenda: clica no horário vazio, marca com cliente novo e conclui', async () => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole('button', { name: 'Agendar com Zé Agenda às 10:00' }).click();

  await page.getByLabel('Buscar cliente').fill('Cliente PW');
  await page.getByRole('button', { name: 'Cadastrar “Cliente PW”' }).click();
  await page.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await expect(page.getByLabel('Horário')).toHaveValue('10:00');
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByText('Agendamento marcado ✨')).toBeVisible();

  const card = page.getByRole('button', { name: /^10:00 Cliente PW — .*\(Agendado\)$/ });
  await expect(card).toBeVisible();
  await card.click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Concluído ✓')).toBeVisible();
  await expect(page.getByRole('button', { name: /^10:00 Cliente PW — .*\(Concluído\)$/ })).toBeVisible();
});

test('mesmo horário com o mesmo profissional é recusado', async () => {
  // A faixa das 10:00 está coberta pelo cartão: usa o botão "Agendar" do topo.
  await page.getByRole('button', { name: 'Agendar', exact: true }).first().click();
  await page.getByLabel('Buscar cliente').fill('Cliente PW');
  await page.getByRole('button', { name: /^Cliente PW/ }).first().click();
  await page.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Horário').fill('10:00');
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Esse horário já está ocupado' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('ficha do cliente mostra o atendimento', async () => {
  await page.goto('/clientes');
  await page.getByRole('link', { name: /Cliente PW/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Concluído').filter({ visible: true }).first()).toBeVisible();
});

/** Marca pelo clique no horário vazio, com cliente novo e o primeiro serviço. */
async function bookAt(time: string, client: string) {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole('button', { name: `Agendar com Zé Agenda às ${time}` }).click();
  await page.getByLabel('Buscar cliente').fill(client);
  await page.getByRole('button', { name: `Cadastrar “${client}”` }).click();
  await page.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByText('Agendamento marcado ✨')).toBeVisible();
}

test('semana: os 7 dias do profissional, com o atendimento no dia certo', async () => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole('button', { name: 'semana', exact: true }).click();
  await expect(page).toHaveURL(/visao=semana/);
  await expect(page.getByText(`Ter ${DD}`)).toBeVisible();
  await expect(page.getByText('Semana ·')).toBeVisible();
  await expect(page.getByRole('button', { name: /^10:00 Cliente PW/ })).toBeVisible();
});

test('arrastar e soltar remarca (desktop)', async ({}, info) => {
  test.skip(info.project.name === 'celular', 'No celular remarca pelo botão "Remarcar".');
  await bookAt('14:00', 'Drag PW');
  const card = page.getByRole('button', { name: /^14:00 Drag PW/ });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  // 1h = 75 px na grade.
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 40, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 75, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText(/Drag PW: 15:00–/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^15:00 Drag PW/ })).toBeVisible();
});

test('lista de espera: avisa quando abre vaga', async () => {
  await bookAt('16:00', 'Vaga PW');
  await page.getByRole('button', { name: /^Espera/ }).click();
  await page.getByRole('button', { name: 'Adicionar à lista' }).click();
  await page.getByLabel('Buscar cliente').fill('Espera PW');
  await page.getByRole('button', { name: 'Cadastrar “Espera PW”' }).click();
  await page.getByRole('button', { name: 'Colocar na lista' }).click();
  await expect(page.getByText('Na lista de espera ✓')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^16:00 Vaga PW/ }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByText('Cancelado ✓')).toBeVisible();

  await page.getByRole('button', { name: /^Espera/ }).click();
  await expect(page.getByText(/Abriu vaga: .* às 16:00 com Zé Agenda/)).toBeVisible();
  // Agendar a partir da lista já preenche cliente, dia e hora — e tira da lista.
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByLabel('Horário')).toHaveValue('16:00');
  await page.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
  await expect(page.getByText('Agendamento marcado ✨')).toBeVisible();
  await expect(page.getByRole('button', { name: /^16:00 Espera PW/ })).toBeVisible();
  await page.getByRole('button', { name: /^Espera/ }).click();
  await expect(page.getByText('Ninguém esperando vaga.')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('página pública: cliente marca sozinho e cancela pelo link', async () => {
  await page.goto(`/${slug}`);
  await page.getByRole('button', { name: /^Corte R\$/ }).click();
  await page.getByRole('button', { name: 'Qualquer pessoa' }).click();
  await page.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
  // 10:00 está ocupado (concluído ocupa); 11:00 está livre.
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Lia Online');
  await page.getByLabel('Celular (WhatsApp)').fill('31988887777');
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();

  await expect(page).toHaveURL(/\/reserva\/[\w-]+$/);
  await expect(page.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();
  await expect(page.getByText('com Zé Agenda')).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar horário' }).click();
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('heading', { name: 'Horário cancelado' })).toBeVisible();
});

test('página de negócio que não existe', async () => {
  await page.goto('/nao-existe-esse-negocio');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
});
