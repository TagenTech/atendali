import { expect, test } from '@playwright/test';
import { EXTERNAL_RUN, PASSWORD, createBusiness, signUp } from './helpers';

const stamp = Date.now().toString(36);
const NOVA = 'cafe-com-leite-9';

const resetLink = async (request: import('@playwright/test').APIRequestContext, email: string) => {
  let link = '';
  await expect
    .poll(async () => {
      const box = (await (await request.get('/api/v1/dev/outbox')).json()) as { to: string; link?: string }[];
      link = box.filter((m) => m.to === email && m.link?.includes('/redefinir-senha')).at(-1)?.link ?? '';
      return link;
    })
    .not.toBe('');
  return link;
};

test.describe('senhas: cadastro, recuperação e troca', () => {
  test('cadastro: cada campo mostra o seu erro e só passa com tudo certo', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('Como podemos te chamar?')).toBeVisible();
    await expect(page.getByText('Informe seu e-mail')).toBeVisible();
    await expect(page.getByText('Use pelo menos 8 caracteres')).toBeVisible();
    await expect(page.getByText('Repita a senha', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Aceite os termos para continuar')).toBeVisible();

    await page.getByLabel('Seu nome').fill('Ana Teste');
    await page.getByLabel('E-mail').fill('isso-nao-e-email');
    await page.getByLabel('Senha', { exact: true }).fill('12345678');
    await page.getByLabel('Confirmar senha').fill('12345678');
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('Esse e-mail não parece certo')).toBeVisible();
    await expect(page.getByText(/muito comum/)).toBeVisible();

    await page.getByLabel('E-mail').fill(`senhas-cad+${stamp}@skedulei.test`);
    await page.getByLabel('Senha', { exact: true }).fill(NOVA);
    await page.getByLabel('Confirmar senha').fill('outra-coisa-123');
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('As senhas precisam ser iguais')).toBeVisible();

    await page.getByLabel('Confirmar senha').fill(NOVA);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page).not.toHaveURL(/\/cadastro/);
  });

  test('a API também recusa senha comum e curta', async ({ request }) => {
    for (const password of ['12345678', 'password123', 'abc']) {
      const res = await request.post('/api/v1/auth/register', { data: { name: 'Teste', email: `comum+${stamp}-${password}@skedulei.test`, password, acceptTerms: true } });
      expect(res.status(), password).toBe(400);
    }
  });

  test('esqueci a senha: e-mail inválido, link por e-mail, regras e login com a nova senha', async ({ page, context }) => {
    test.skip(EXTERNAL_RUN, 'usa o /api/v1/dev/outbox, que só existe na API de teste local');
    const email = `senhas-rec+${stamp}@skedulei.test`;
    await signUp(context, 'Rita Recupera', email);
    await context.clearCookies();

    await page.goto('/esqueci-senha');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText('Esse e-mail não parece certo')).toBeVisible();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await page.goto(await resetLink(page.request, email));
    const salvar = page.getByRole('button', { name: 'Salvar nova senha' });
    await page.getByLabel('Nova senha', { exact: true }).fill('abc');
    await page.getByLabel('Repita a senha').fill('abc');
    await salvar.click();
    await expect(page.getByText('Use pelo menos 8 caracteres')).toBeVisible();

    await page.getByLabel('Nova senha', { exact: true }).fill('12345678');
    await page.getByLabel('Repita a senha').fill('12345678');
    await salvar.click();
    await expect(page.getByText(/muito comum/)).toBeVisible();

    await page.getByLabel('Nova senha', { exact: true }).fill(NOVA);
    await page.getByLabel('Repita a senha').fill('diferente-123');
    await salvar.click();
    await expect(page.getByText('As senhas não batem')).toBeVisible();

    await page.getByLabel('Repita a senha').fill(NOVA);
    await salvar.click();
    await expect(page).toHaveURL(/\/login/);

    // a senha antiga deixou de valer e a nova entra
    const antiga = await page.request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
    expect(antiga.status()).toBe(401);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(NOVA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('o mesmo link de redefinição não funciona duas vezes', async ({ page, context }) => {
    test.skip(EXTERNAL_RUN, 'usa o /api/v1/dev/outbox, que só existe na API de teste local');
    const email = `senhas-uso+${stamp}@skedulei.test`;
    await signUp(context, 'Uso Único', email);
    await context.clearCookies();
    await page.request.post('/api/v1/auth/forgot-password', { data: { email } });
    const link = await resetLink(page.request, email);
    const token = link.split('token=')[1];
    const first = await page.request.post('/api/v1/auth/reset-password', { data: { token, password: NOVA } });
    expect(first.status()).toBeLessThan(300);
    const again = await page.request.post('/api/v1/auth/reset-password', { data: { token, password: 'outra-senha-789' } });
    expect(again.status()).toBeGreaterThanOrEqual(400);
  });

  test('trocar senha logado: pede a atual, recusa comum e diferente, e salva', async ({ page, context }) => {
    await createBusiness(context, `troca${stamp}`);
    await page.goto('/mais/seguranca');
    await page.getByRole('button', { name: 'Alterar' }).click();
    const salvar = page.getByRole('button', { name: 'Salvar nova senha' });

    await salvar.click();
    await expect(page.getByText('Informe a senha atual')).toBeVisible();
    await expect(page.getByText('Use pelo menos 8 caracteres')).toBeVisible();

    await page.getByLabel('Senha atual').fill(PASSWORD);
    await page.getByLabel('Nova senha', { exact: true }).fill('12345678');
    await page.getByLabel('Repita a nova senha').fill('12345678');
    await salvar.click();
    await expect(page.getByText(/muito comum/)).toBeVisible();

    await page.getByLabel('Nova senha', { exact: true }).fill(NOVA);
    await page.getByLabel('Repita a nova senha').fill('nao-bate-123');
    await salvar.click();
    await expect(page.getByText('As senhas não batem')).toBeVisible();

    await page.getByLabel('Senha atual').fill('senha-errada-999');
    await page.getByLabel('Repita a nova senha').fill(NOVA);
    await salvar.click();
    await expect(page.getByRole('alert').filter({ hasText: /senha/i }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/mais\/seguranca/);

    await page.getByLabel('Senha atual').fill(PASSWORD);
    await salvar.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
