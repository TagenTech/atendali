import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { nextTuesday } from '../e2e/helpers';

/**
 * Vídeo do fluxo completo de uma clínica pediátrica, em 3 atos:
 *   1. a clínica se cadastra, monta o negócio e agenda pela recepção;
 *   2. a mãe de uma paciente marca sozinha pelo celular (e cancela outro horário);
 *   3. a clínica atende, recebe (Pix e dinheiro), fecha o caixa, paga comissão e vê o financeiro.
 * Legendas na tela explicam cada passo. Os vídeos vão para apps/web/videos/.
 */
const OUT = path.resolve(__dirname, '../videos');
const RAW = path.join(OUT, '.raw');
const DAY = nextTuesday();
const [, MM, DD] = DAY.split('-');
const stamp = Date.now().toString(36);
const DONA = { name: 'Dra. Helena Souza', email: `helena+${stamp}@agendei.test`, password: 'senha-forte-123' };
const CLINICA = 'Clínica Pediátrica Pequenos Passos';
const CONSULTA = 'Consulta pediátrica · 30 min · R$ 280,00';
const DESKTOP = { width: 1366, height: 860 };

/** Faixa de legenda que sobrevive às navegações. */
async function legendar(page: Page, texto: string) {
  await page.evaluate((t) => {
    sessionStorage.setItem('__legenda', t);
    document.getElementById('__legenda')?.remove();
    const el = document.createElement('div');
    el.id = '__legenda';
    el.textContent = t;
    el.setAttribute('style', 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:92vw;z-index:2147483647;background:rgba(17,24,39,.92);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:14px;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35)');
    document.body.appendChild(el);
  }, texto);
  await page.waitForTimeout(1400);
}

const prepararLegendas = (ctx: BrowserContext) =>
  ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const t = sessionStorage.getItem('__legenda');
      if (!t) return;
      const el = document.createElement('div');
      el.id = '__legenda';
      el.textContent = t;
      el.setAttribute('style', 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:92vw;z-index:2147483647;background:rgba(17,24,39,.92);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:14px;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35)');
      document.body.appendChild(el);
    });
  });

/** Abre um contexto gravando vídeo e devolve a página + como fechar salvando o arquivo com o nome do ato. */
async function ato(browser: Browser, nome: string, opts: Parameters<Browser['newContext']>[0]) {
  const size = opts?.viewport ?? DESKTOP;
  const ctx = await browser.newContext({ ...opts, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', recordVideo: { dir: RAW, size } });
  await prepararLegendas(ctx);
  const page = await ctx.newPage();
  return {
    ctx,
    page,
    fechar: async () => {
      const video = page.video();
      await ctx.close();
      await video?.saveAs(path.join(OUT, `${nome}.webm`));
    },
  };
}

test.beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
});

test('clínica pediátrica: do cadastro ao financeiro', async ({ browser }) => {
  let storage: Awaited<ReturnType<BrowserContext['storageState']>>;
  let slug = '';

  // ───────── Ato 1 · a clínica se cadastra e agenda pela recepção ─────────
  {
    const { ctx, page, fechar } = await ato(browser, '1-clinica-cadastro-e-agenda', { viewport: DESKTOP });
    await page.goto('/cadastro');
    await legendar(page, 'Ato 1 · A Dra. Helena cria a conta da clínica');
    await page.getByLabel('Seu nome').fill(DONA.name);
    await page.getByLabel('E-mail').fill(DONA.email);
    await page.getByLabel('Senha', { exact: true }).fill(DONA.password);
    await page.getByLabel('Confirmar senha').fill(DONA.password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();

    await legendar(page, 'Escolhe o tipo de negócio: Clínica médica (o sistema passa a falar "paciente" e "consulta")');
    await page.getByRole('button', { name: /Clínica médica/ }).click();
    await page.getByLabel('Nome do negócio').fill(CLINICA);
    for (const step of ['Horário', 'Procedimentos', 'Equipe', 'Módulos']) {
      await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
      await expect(page.getByRole('heading', { name: step })).toBeVisible();
      await legendar(page, `Configuração inicial · ${step}`);
    }
    await page.getByRole('button', { name: 'Criar meu negócio' }).click();
    await expect(page.getByRole('main').getByText(CLINICA)).toBeVisible();
    await legendar(page, 'Clínica criada! Já tem página de agendamento online própria');

    await page.goto('/servicos');
    await legendar(page, 'Cadastrando a consulta pediátrica');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Consulta pediátrica');
    await page.getByLabel('Categoria').fill('Consultas');
    await page.getByRole('button', { name: '30 min', exact: true }).click();
    await page.getByLabel('Preço').fill('28000');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(/criado/)).toBeVisible();

    await page.goto('/equipe');
    await legendar(page, 'A pediatra recebe 40% de comissão sobre cada consulta');
    await page.getByRole('main').getByText(/^Dra\. Helena/).filter({ visible: true }).first().click();
    await page.getByLabel('Comissão padrão').fill('40');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alterações salvas')).toBeVisible();

    for (const [hora, paciente] of [['09:00', 'Theo Almeida'], ['10:00', 'Alice Ramos']] as const) {
      await page.goto(`/agenda?data=${DAY}`);
      await legendar(page, `Recepção agenda ${paciente} às ${hora}`);
      await page.getByRole('button', { name: `Agendar com ${DONA.name} às ${hora}` }).click();
      await page.getByLabel(/Buscar (cliente|paciente)/).fill(paciente);
      await page.getByRole('button', { name: `Cadastrar “${paciente}”` }).click();
      await page.getByLabel(/^(Serviço|Procedimento)$/).selectOption({ label: CONSULTA });
      await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
      await expect(page.getByText(/(Agendamento|Consulta) marcad[oa] ✨/)).toBeVisible();
    }
    await legendar(page, 'Agenda do dia com as duas consultas marcadas pela recepção');

    // endereço público da clínica (aparece em Configurações)
    await page.goto('/configuracoes');
    const link = page.getByText(/\/[a-z0-9-]*pequenos-passos[a-z0-9-]*/).first();
    await expect(link).toBeVisible();
    slug = ((await link.textContent()) ?? '').match(/\/([a-z0-9-]*pequenos-passos[a-z0-9-]*)/)![1];
    await legendar(page, `Página pública da clínica: /${slug}`);
    storage = await ctx.storageState();
    await fechar();
  }

  // ───────── Ato 2 · a mãe marca sozinha pelo celular ─────────
  {
    const { page, fechar } = await ato(browser, '2-paciente-agenda-pelo-celular', { ...devices['Pixel 7'] });
    await page.goto(`/${slug}`);
    await legendar(page, 'Ato 2 · Visão da paciente: Mariana abre o link da clínica no celular');
    await page.getByRole('button', { name: /^Consulta pediátrica R\$/ }).click();
    await legendar(page, 'Escolhe a consulta e a profissional');
    await page.getByRole('button', { name: 'Qualquer pessoa' }).click();
    await page.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
    await legendar(page, '09:00 e 10:00 já estão ocupados pela recepção — só aparecem horários livres');
    await expect(page.getByRole('button', { name: '09:00', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '11:00', exact: true }).click();
    await page.getByLabel('Seu nome').fill('Mariana Costa (mãe da Sofia)');
    await page.getByLabel('Celular (WhatsApp)').fill('11988887777');
    await legendar(page, 'Só nome e WhatsApp — sem criar conta');
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page).toHaveURL(/\/reserva\/[\w-]+$/);
    await expect(page.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();
    await legendar(page, 'Confirmado! A paciente guarda o link para ver, remarcar ou cancelar');

    // Segundo horário: marca e desiste, para mostrar o cancelamento.
    await page.goto(`/${slug}`);
    await page.getByRole('button', { name: /^Consulta pediátrica R\$/ }).click();
    await page.getByRole('button', { name: 'Qualquer pessoa' }).click();
    await page.getByRole('button', { name: `Dia ${DD}/${MM}` }).click();
    await page.getByRole('button', { name: '15:00', exact: true }).click();
    await page.getByLabel('Seu nome').fill('Carlos Nunes (pai do Davi)');
    await page.getByLabel('Celular (WhatsApp)').fill('11977776666');
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('heading', { name: 'Horário marcado! 🎉' })).toBeVisible();
    await legendar(page, 'Outro pai marca às 15:00… e precisa desmarcar');
    await page.getByRole('button', { name: 'Cancelar horário' }).click();
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
    await expect(page.getByRole('heading', { name: 'Horário cancelado' })).toBeVisible();
    await legendar(page, 'Cancelado pelo próprio link — o horário volta a ficar livre na agenda');
    await fechar();
  }

  // ───────── Ato 3 · atendimento, cobrança, caixa e financeiro ─────────
  {
    const { page, fechar } = await ato(browser, '3-clinica-atende-cobra-e-fecha', { viewport: DESKTOP, storageState: storage! });
    await page.goto(`/agenda?data=${DAY}`);
    await legendar(page, 'Ato 3 · A agenda da clínica já mostra a reserva online da Mariana às 11:00');
    await expect(page.getByRole('button', { name: /^11:00 Mariana Costa/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^15:00 Carlos Nunes/ })).toHaveCount(0);

    await page.getByRole('button', { name: /^09:00 Theo Almeida/ }).click();
    await legendar(page, 'Theo foi atendido: abre a comanda para cobrar');
    await page.getByRole('button', { name: 'Abrir comanda' }).click();
    await expect(page.getByRole('heading', { name: /Comanda #1/ })).toBeVisible();
    await expect(page.getByText('O caixa está fechado')).toBeVisible();
    await legendar(page, 'Para receber é preciso abrir o caixa do dia');
    const orderUrl = page.url();
    await page.getByRole('link', { name: 'Abrir caixa' }).click();
    await page.getByLabel('Troco inicial').fill('10000');
    await page.getByRole('button', { name: 'Abrir caixa' }).click();
    await expect(page.getByText('Caixa aberto ✓')).toBeVisible();
    await legendar(page, 'Caixa aberto com R$ 100,00 de troco inicial');
    await page.goto(orderUrl);
    await legendar(page, 'Theo paga a consulta de R$ 280,00 no Pix');
    await page.getByRole('radio', { name: 'Pix' }).click();
    await page.getByRole('button', { name: 'Registrar pagamento' }).click();
    await page.getByRole('button', { name: 'Fechar comanda' }).click();
    await expect(page.getByText('Comanda paga ✓')).toBeVisible();
    await legendar(page, 'Comanda paga: a comissão da pediatra é gerada sozinha');

    await page.goto(`/agenda?data=${DAY}`);
    await page.getByRole('button', { name: /^10:00 Alice Ramos/ }).click();
    await page.getByRole('button', { name: 'Abrir comanda' }).click();
    await legendar(page, 'Alice paga em dinheiro com R$ 300,00 — o sistema calcula o troco');
    await page.getByRole('radio', { name: 'Dinheiro' }).click();
    await page.getByLabel('Recebido em dinheiro').fill('30000');
    await expect(page.getByText('Troco: R$ 20,00')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar pagamento' }).click();
    await page.getByRole('button', { name: 'Fechar comanda' }).click();
    await expect(page.getByText('Comanda paga ✓')).toBeVisible();

    await page.goto('/financeiro/contas');
    await legendar(page, 'Lançando uma despesa: aluguel do consultório');
    await page.getByRole('button', { name: /nova conta|conta a pagar/i }).first().click();
    await page.getByLabel('Descrição').fill('Aluguel do consultório');
    await page.getByLabel('Valor').fill('450000');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('Conta criada')).toBeVisible();

    await page.goto('/comissoes');
    await legendar(page, 'Comissão da Dra. Helena: 40% de R$ 560,00 = R$ 224,00');
    await expect(page.getByText('A pagar').locator('..')).toContainText('R$ 224,00');
    await page.getByRole('button', { name: 'Fechar e pagar' }).click();
    await page.getByRole('button', { name: /Confirmar pagamento de R\$ 224,00/ }).click();
    await expect(page.getByText(/Fechamento de .* registrado/)).toBeVisible();

    await page.goto('/caixa');
    await legendar(page, 'Fim do dia: conferindo a gaveta (R$ 100 de troco + R$ 280 em dinheiro)');
    await page.getByRole('button', { name: 'Fechar caixa' }).click();
    await page.getByLabel('Dinheiro contado na gaveta').fill('38000');
    await expect(page.getByText('Bateu certinho ✓')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar caixa' }).last().click();
    await expect(page.getByText('Caixa fechado ✓')).toBeVisible();

    await page.goto('/financeiro');
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await expect(page.getByRole('main').getByText('Faturamento', { exact: true }).locator('..')).toContainText('R$ 560,00');
    await legendar(page, 'Financeiro: faturamento de R$ 560,00, comissão e resultado do dia');
    await page.goto('/financeiro/dre');
    await legendar(page, 'DRE: receitas, comissões e a despesa do aluguel');
    await page.goto('/clientes');
    await legendar(page, 'E a ficha de cada paciente guarda o histórico de consultas');
    await fechar();
  }

  // Junta os 3 atos num só arquivo (mp4), se o ffmpeg estiver instalado.
  try {
    const partes = readdirSync(OUT).filter((f) => f.endsWith('.webm')).sort();
    const lista = path.join(RAW, 'lista.txt');
    const filtros = partes.map((_, i) => `[${i}:v]scale=1366:860:force_original_aspect_ratio=decrease,pad=1366:860:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=25[v${i}]`).join(';');
    const entradas = partes.flatMap((f) => ['-i', path.join(OUT, f)]);
    const concat = `${partes.map((_, i) => `[v${i}]`).join('')}concat=n=${partes.length}:v=1:a=0[out]`;
    writeFileSync(lista, partes.join('\n'));
    execFileSync('ffmpeg', ['-y', ...entradas, '-filter_complex', `${filtros};${concat}`, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', path.join(OUT, 'pediatria-completo.mp4')], { stdio: 'ignore' });
  } catch {
    /* sem ffmpeg: ficam os 3 .webm separados */
  }
  rmSync(RAW, { recursive: true, force: true });
});
