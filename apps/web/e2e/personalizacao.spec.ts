import { expect, test, type Page } from '@playwright/test';

/**
 * Personalização da página pública, no celular e no desktop:
 * logo e fundo enviados em Negócio → cor e frase → o cliente vê tudo ao agendar (e cancela) → remover volta ao padrão.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let slug = '';

// PNG 16×16 válido (o navegador reduz e reenvia).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGPIiXr2nxLMMGrAqAGjBgwXAwCKxqsfQqmqigAAAABJRU5ErkJggg==', 'base64');

function nextTuesday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const [, MM, DD] = nextTuesday().split('-');

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  const stamp = `${info.project.name}-${Date.now()}`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Zé Visual');
  await page.getByLabel('E-mail').fill(`ze-visual+${stamp}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByLabel('Confirmar senha').fill('senha-forte-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: /Barbearia/ }).click();
  await page.getByLabel('Nome do negócio').fill(`Barbearia Visual ${stamp}`);
  for (const step of ['Horário de funcionamento', /Serviços que você oferece/, 'Sua equipe', 'Módulos']) {
    await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
    await expect(page.getByRole('heading', { name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Criar meu negócio' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  slug = `barbearia-visual-${stamp}`.toLowerCase();
});

test.afterAll(async () => {
  await page.close();
});

test('sem personalização a página usa o padrão', async ({ browser }) => {
  const anon = await browser.newPage();
  await anon.goto(`/${slug}`);
  await expect(anon.getByRole('heading', { name: /Barbearia Visual/ })).toBeVisible();
  // Sem logo própria, a página pública mostra a logo do Skedulei.
  await expect(anon.locator('img')).toHaveCount(1);
  await anon.close();
});

test('envia logo e fundo, escolhe a cor e a frase', async () => {
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Aparência da página' })).toBeVisible();
  await page.getByLabel('Arquivo da logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Logo atualizada ✨')).toBeVisible();
  await page.getByLabel('Arquivo da imagem de fundo').setInputFiles({ name: 'fundo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Imagem de fundo atualizada ✨')).toBeVisible();

  await page.getByRole('radio', { name: 'Rosa' }).click();
  await page.getByLabel('Frase de boas-vindas').fill('Corte e barba com hora marcada');
  await page.locator('form', { has: page.getByLabel('Frase de boas-vindas') }).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Aparência salva')).toBeVisible();
  // Texto de formulário inválido (arquivo que não é imagem) é recusado sem quebrar a tela.
  await page.getByLabel('Arquivo da logo').setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') });
  await expect(page.getByText(/Escolha uma imagem PNG, JPG ou WebP/)).toBeVisible();
});

test('o cliente vê logo, fundo, cor e frase; agenda e cancela', async ({ browser }) => {
  const anon = await browser.newPage();
  await anon.goto(`/${slug}`);
  await expect(anon.getByText('Corte e barba com hora marcada')).toBeVisible();
  await expect(anon.getByRole('img', { name: /Logo de Barbearia Visual/ })).toBeVisible();
  // Capa + logo própria + selo Skedulei — todas têm que terminar de carregar.
  await expect(anon.locator('img')).toHaveCount(3);
  await anon.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
  // A cor rosa entra nos tokens só desta página.
  const primary = await anon.locator('main').evaluate((el) => getComputedStyle(el).getPropertyValue('--primary').trim());
  expect(primary).toBe('#d6409f');

  await anon.getByRole('button', { name: /^Corte R\$/ }).click();
  await anon.getByRole('button', { name: 'Qualquer pessoa' }).click();
  await anon.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
  await anon.getByRole('button', { name: '09:00', exact: true }).click();
  await anon.getByLabel('Seu nome').fill('Cliente Visual');
  await anon.getByLabel('Celular (WhatsApp)').fill('31977776666');
  await anon.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(anon).toHaveURL(/\/reserva\/[\w-]+$/);
  await expect(anon.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();

  // A equipe vê o horário na agenda…
  await page.goto(`/agenda?data=${nextTuesday()}`);
  await expect(page.getByRole('button', { name: /^09:00 Cliente Visual/ })).toBeVisible();

  // …e o cancelamento libera o horário.
  await anon.getByRole('button', { name: 'Cancelar horário' }).click();
  await anon.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(anon.getByRole('heading', { name: 'Horário cancelado' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^09:00 Cliente Visual/ })).toHaveCount(0);
  await anon.close();
});

test('remover o fundo e a logo volta ao padrão', async ({ browser }) => {
  await page.goto('/configuracoes');
  for (const label of ['Logo', 'Imagem de fundo']) {
    await page.getByRole('button', { name: 'Remover' }).first().click();
    await expect(page.getByText(new RegExp(`${label}|Escolher imagem`)).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Escolher imagem' })).toHaveCount(2);
  const anon = await browser.newPage();
  await anon.goto(`/${slug}`);
  // Voltou ao padrão: a logo do Skedulei reaparece no lugar da logo enviada.
  await expect(anon.locator('img')).toHaveCount(1);
  await expect(anon.getByText('Corte e barba com hora marcada')).toBeVisible();
  await anon.close();
});
