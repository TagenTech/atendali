import { expect, test, type Page } from '@playwright/test';

/**
 * Fase 3 de ponta a ponta, no celular e no desktop:
 * módulos e regra de pontos → estoque → pacote vendido e usado na comanda → produto com resgate de pontos →
 * pedido de avaliação e resposta pelo link público → avaliações e painel de TV.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let reviewPath = '';

const newOrder = async () => {
  await page.goto('/caixa');
  await page.getByRole('button', { name: 'Nova comanda' }).first().click();
  await expect(page).toHaveURL(/\/caixa\/[0-9a-f-]{36}$/);
};

const pickClient = async () => {
  await page.getByRole('button', { name: 'Escolher' }).click();
  await page.getByLabel('Buscar cliente').fill('Cliente Retenção');
  await page.getByRole('button', { name: /^Cliente Retenção/ }).click();
  await expect(page.getByText('Cliente definido')).toBeVisible();
};

const payCash = async (cents: string) => {
  await page.getByRole('radio', { name: 'Dinheiro' }).click();
  await page.getByLabel('Recebido em dinheiro').fill(cents);
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(page.getByRole('button', { name: 'Fechar comanda' })).toBeEnabled();
  await page.getByRole('button', { name: 'Fechar comanda' }).click();
  await expect(page.getByText('Comanda paga ✓')).toBeVisible();
};

test.beforeAll(async ({ browser }, info) => {
  page = await browser.newPage();
  const stamp = `${info.project.name}-${Date.now()}`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Zé Retenção');
  await page.getByLabel('E-mail').fill(`ze-ret+${stamp}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByLabel('Confirmar senha').fill('senha-forte-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: /Barbearia/ }).click();
  await page.getByLabel('Nome do negócio').fill(`Barbearia Retenção ${stamp}`);
  for (const step of ['Horário de funcionamento', /Serviços que você oferece/, 'Sua equipe', 'Módulos']) {
    await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
    await expect(page.getByRole('heading', { name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Criar meu negócio' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
});

test.afterAll(async () => {
  await page.close();
});

test('liga os módulos e define a regra de pontos', async () => {
  await page.goto('/configuracoes');
  for (const name of [/Pacotes de sessões/, /Vale-presente/, /Programa de fidelidade/]) {
    // Teclado: no celular a lista é longa e o clique cai sob a barra/toast.
    await page.getByRole('switch', { name }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
  }
  await expect(page.getByRole('heading', { name: 'Pontos de fidelidade' })).toBeVisible();
  await page.getByRole('switch', { name: /Programa de pontos/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).last().click();
  await expect(page.getByText('Regras de pontos salvas')).toBeVisible();
});

test('estoque: produto de venda e entrada', async () => {
  await page.goto('/estoque');
  await page.getByRole('button', { name: 'Novo' }).click();
  await page.getByLabel('Nome').fill('Pomada');
  await page.getByLabel('Preço de venda').fill('3000');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Produto cadastrado ✨')).toBeVisible();

  await page.getByRole('button', { name: /Lançar/ }).filter({ visible: true }).first().click();
  await page.getByLabel('Quantidade').fill('10');
  await page.getByRole('dialog').getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(page.getByText('Estoque atualizado')).toBeVisible();
  await expect(page.getByRole('main').getByText(/^10 un/).filter({ visible: true }).first()).toBeVisible();
});

test('pacote e cliente cadastrados', async () => {
  await page.goto('/fidelidade');
  await page.getByRole('button', { name: 'Novo' }).click();
  await page.getByLabel('Nome').fill('5 cortes');
  await page.getByLabel('Serviço', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Sessões').fill('5');
  await page.getByLabel('Preço do pacote').fill('20000');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Pacote criado ✨')).toBeVisible();
  await expect(page.getByRole('main').getByText('5 cortes').first()).toBeVisible();

  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo' }).first().click();
  await page.getByLabel('Nome').fill('Cliente Retenção');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('main').getByText('Cliente Retenção').first()).toBeVisible();
});

test('vende o pacote e usa uma sessão na comanda', async () => {
  await page.goto('/caixa');
  await page.getByLabel('Troco inicial').fill('5000');
  await page.getByRole('button', { name: 'Abrir caixa' }).click();
  await expect(page.getByText('Caixa aberto ✓')).toBeVisible();

  // Venda: R$ 200,00 → 200 pontos.
  await newOrder();
  await pickClient();
  await page.getByRole('button', { name: 'Vender pacote' }).click();
  await page.getByLabel('Pacote', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await expect(page.getByText('Item adicionado')).toBeVisible();
  await payCash('20000');

  // Uso: valor zero, fecha sem pagamento.
  await newOrder();
  await pickClient();
  await page.getByRole('button', { name: 'Usar pacote' }).click();
  await page.getByLabel('Pacote do cliente').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await expect(page.getByText('Item adicionado')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar comanda' }).click();
  await expect(page.getByText('Comanda paga ✓')).toBeVisible();

  await page.getByRole('link', { name: 'Cliente Retenção' }).click();
  await expect(page.getByText('4 de 5 sessões')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pontos' })).toBeVisible();
});

test('produto com resgate de pontos baixa o estoque e pede a avaliação', async () => {
  await newOrder();
  await pickClient();
  await page.getByRole('button', { name: 'Produto', exact: true }).click();
  await page.getByLabel('Produto', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Qtd.').fill('2');
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await expect(page.getByText('Item adicionado')).toBeVisible();

  // 200 pontos ganhos; 100 viram R$ 10,00 de desconto: R$ 60,00 → R$ 50,00.
  await expect(page.getByText(/Saldo: 200 pontos/)).toBeVisible();
  await page.getByRole('button', { name: 'Resgatar mais' }).click();
  await expect(page.getByText('Pontos aplicados')).toBeVisible();
  await expect(page.getByText('100 pontos = − R$ 10,00')).toBeVisible();
  await payCash('5000');

  await page.getByRole('button', { name: 'Pedir avaliação' }).click();
  const message = page.getByText(/\/avaliar\//);
  await expect(message).toBeVisible();
  reviewPath = new URL((await message.innerText()).match(/https?:\/\/\S+\/avaliar\/\S+/)![0]).pathname;

  await page.goto('/estoque');
  await expect(page.getByRole('main').getByText(/^8 un/).filter({ visible: true }).first()).toBeVisible();
});

test('a pessoa avalia pelo link, sem login, uma vez só', async ({ browser }) => {
  const anon = await browser.newPage();
  await anon.goto(reviewPath);
  await anon.getByRole('radio', { name: /^5 estrelas/ }).click();
  await anon.getByLabel(/Quer contar mais/).fill('Atendimento ótimo!');
  await anon.getByRole('button', { name: 'Enviar avaliação' }).click();
  await expect(anon.getByRole('heading', { name: /Obrigado/ })).toBeVisible();
  await anon.reload();
  await expect(anon.getByRole('heading', { name: 'Você já avaliou' })).toBeVisible();
  await anon.close();
});

test('avaliações aparecem para a equipe e o painel de TV abre', async () => {
  await page.goto('/avaliacoes');
  await expect(page.getByText('Atendimento ótimo!').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Cliente R.').filter({ visible: true }).first()).toBeVisible();

  await page.goto('/tv');
  await expect(page.getByRole('region', { name: 'Chamando agora' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Aguardando' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sair do painel' })).toBeVisible();
});
