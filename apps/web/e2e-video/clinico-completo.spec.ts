import { devices, expect, test, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ato, DESKTOP, legendar, limparSaida, VIDEOS } from './_helpers';

/**
 * Vídeo do módulo clínico (prontuário, prescrição, atestado, anamnese e termo).
 *   1. a clínica se cadastra com os módulos de saúde e abre a ficha do paciente;
 *   2. evolução, prescrição e atestado no prontuário;
 *   3. anamnese e termo preenchidos pelo celular; a clínica lê as respostas.
 *   pnpm --filter @skedulei/web exec playwright test -c playwright.video.config.ts clinico
 */
const PREFIX = 'clinico-';
const RAW = path.join(VIDEOS, '.raw-clinico');
const stamp = Date.now().toString(36);
const DONA = { name: 'Dra. Helena Souza', email: `helena.clinico+${stamp}@skedulei.test`, password: 'senha-forte-123' };
const CLINICA = 'Clínica Pediátrica Pequenos Passos';
const PACIENTE = 'Sofia Costa';

test.beforeAll(() => limparSaida((f) => f.startsWith(PREFIX) || f === '.raw-clinico', RAW));

test('módulo clínico: prontuário, prescrição, anamnese e termo', async ({ browser }) => {
  // Cadastro + 3 atos de prontuário + celular: passa dos 15 min padrão com o slowMo do vídeo.
  test.setTimeout(25 * 60_000);
  let storage: Awaited<ReturnType<BrowserContext['storageState']>>;
  let clientPath = '';

  // ───────── Ato 1 · cadastro, módulos clínicos e ficha do paciente ─────────
  {
    const { ctx, page, fechar } = await ato(browser, `${PREFIX}1-modulos-e-paciente.webm`, RAW, { viewport: DESKTOP });
    await page.goto('/cadastro');
    await legendar(page, 'Ato 1 · A Dra. Helena cria a conta da clínica');
    await page.getByLabel('Seu nome').fill(DONA.name);
    await page.getByLabel('E-mail').fill(DONA.email);
    await page.getByLabel('Senha', { exact: true }).fill(DONA.password);
    await page.getByLabel('Confirmar senha').fill(DONA.password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();

    await legendar(page, 'Negócio: Clínica médica — o sistema fala "paciente" e guarda dado de saúde');
    await page.getByRole('button', { name: /Clínica médica/ }).click();
    await page.getByLabel('Nome do negócio').fill(CLINICA);
    for (const step of ['Horário', 'Procedimentos', 'Equipe']) {
      await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
      await expect(page.getByRole('heading', { name: step })).toBeVisible();
    }
    await page.getByRole('button', { name: /Continuar|Pular por agora/ }).click();
    await expect(page.getByRole('heading', { name: 'Módulos' })).toBeVisible();
    await legendar(page, 'Módulos clínicos já ligados: anamnese, termos e prontuário (dado de saúde)');
    await expect(page.getByRole('switch', { name: /Fichas de anamnese/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: /Termos de consentimento/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: /Prontuário/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Criar meu negócio' }).click();
    await expect(page.getByRole('main').getByText(CLINICA)).toBeVisible();

    await page.goto('/clientes');
    await legendar(page, 'Cadastrando a paciente Sofia Costa');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill(PACIENTE);
    await page.getByLabel(/Celular/).fill('11988887777');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Paciente cadastrado ✨')).toBeVisible();
    // Após salvar, a lista já abre a ficha.
    await expect(page.getByRole('heading', { name: PACIENTE })).toBeVisible();
    clientPath = page.url().replace(/^https?:\/\/[^/]+/, '');
    expect(clientPath).toMatch(/^\/clientes\/[\w-]+$/);
    await legendar(page, 'Na ficha: prontuário (só quem atende lê) e documentos para o paciente preencher');
    await expect(page.getByRole('region', { name: 'Prontuário' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Documentos do paciente' })).toBeVisible();
    storage = await ctx.storageState();
    await fechar();
  }

  // ───────── Ato 2 · evolução, prescrição e atestado ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}2-prontuario-prescricao-atestado.webm`, RAW, {
      viewport: DESKTOP,
      storageState: storage!,
    });
    await page.goto(clientPath);
    const prontuario = page.getByRole('region', { name: 'Prontuário' });
    await expect(prontuario.getByText('Ainda não há evolução, prescrição ou atestado.')).toBeVisible();
    await legendar(page, 'Ato 2 · Evolução da consulta: queixa, exame, sinais e conduta');

    await prontuario.getByRole('button', { name: 'Nova anotação' }).click();
    const ficha = page.getByRole('dialog');
    await ficha.getByLabel('Queixa').fill('Febre e tosse há 2 dias. Sem falta de ar.');
    await ficha.getByLabel('Exame').fill('Bom estado geral. Orofaringe hiperemiada. Ausculta limpa.');
    await ficha.getByLabel('PA').fill('95/60');
    await ficha.getByLabel('FC').fill('92');
    await ficha.getByLabel('Temp.').fill('38,2');
    await ficha.getByLabel('Peso').fill('18');
    await ficha.getByLabel('Avaliação').fill('IVAS — provável viral');
    await ficha.getByLabel('Conduta').fill('Hidratação, antitérmico se febre, retorno se piorar.');
    await legendar(page, 'A evolução fica no prontuário — cifrada e auditada');
    await ficha.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Anotação salva').last()).toBeVisible();
    await expect(prontuario.getByText(/Febre e tosse/)).toBeVisible();

    await prontuario.getByRole('button', { name: 'Nova anotação' }).click();
    await legendar(page, 'Prescrição: medicamentos com dose, frequência e duração');
    const rx = page.getByRole('dialog');
    await rx.getByRole('button', { name: 'Prescrição' }).click();
    await rx.getByLabel('Medicamento 1').fill('Dipirona 500 mg/ml');
    await rx.getByLabel('Dose').first().fill('10 gotas');
    await rx.getByLabel('Frequência').first().fill('6/6 h se febre');
    await rx.getByLabel('Duração').first().fill('3 dias');
    await rx.getByRole('button', { name: 'Outro medicamento' }).click();
    await rx.getByLabel('Medicamento 2').fill('Soro fisiológico 0,9%');
    await rx.getByLabel('Dose').nth(1).fill('lavagem nasal');
    await rx.getByLabel('Frequência').nth(1).fill('3x/dia');
    await rx.getByLabel('Orientação').fill('Retornar se febre persistir além de 72 h ou surgir falta de ar.');
    await expect(rx.getByText('Como fica a receita')).toBeVisible();
    await rx.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Anotação salva').last()).toBeVisible();
    await expect(prontuario.getByText(/Dipirona 500 mg/)).toBeVisible();

    await prontuario.getByRole('button', { name: 'Nova anotação' }).click();
    await legendar(page, 'Atestado: dias de afastamento (CID opcional)');
    const at = page.getByRole('dialog');
    await at.getByRole('button', { name: 'Atestado' }).click();
    await at.getByLabel('Dias de afastamento').fill('2');
    await at.getByLabel('CID').fill('J06.9');
    await at.getByLabel('Observação').fill('Repouso domiciliar. Retorno se piorar.');
    await expect(at.getByText('Como fica o atestado')).toBeVisible();
    await at.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Anotação salva').last()).toBeVisible();
    await expect(prontuario.getByText(/2 dias de afastamento/)).toBeVisible();
    await legendar(page, 'Prontuário completo: evolução, receita e atestado na mesma ficha');
    // O cookie de refresh gira durante o uso — precisa da sessão atualizada nos atos seguintes.
    storage = await (await page.context()).storageState();
    await fechar();
  }

  let anamneseLink = '';
  let termoLink = '';

  // ───────── Ato 3 · clínica gera o link da anamnese ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}3-envia-anamnese.webm`, RAW, {
      viewport: DESKTOP,
      storageState: storage!,
    });
    await page.goto(clientPath);
    await expect(page.getByRole('heading', { name: PACIENTE })).toBeVisible();
    const docs = page.getByRole('region', { name: 'Documentos do paciente' });
    await expect(docs.getByRole('button', { name: 'Enviar' })).toBeVisible();
    await legendar(page, 'Ato 3 · Enviando a anamnese: a mãe preenche no celular, sem criar conta');
    await docs.getByRole('button', { name: 'Enviar' }).click();
    await page.locator('#doc-template').selectOption({ label: 'Ficha de anamnese · Anamnese' });
    await page.getByRole('button', { name: 'Gerar link' }).click();
    anamneseLink = await page.getByLabel('Link para o paciente').inputValue();
    expect(anamneseLink).toMatch(/\/documento\/[\w-]+$/);
    await legendar(page, 'Link gerado — vale 7 dias, uso único');
    storage = await page.context().storageState();
    await fechar();
  }

  // ───────── Ato 3a · mãe preenche no celular ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}3a-mae-preenche-anamnese.webm`, RAW, { ...devices['Pixel 7'] });
    await page.goto(anamneseLink.replace(/^https?:\/\/[^/]+/, ''));
    await legendar(page, 'No celular da mãe: ficha de anamnese da Sofia');
    await expect(page.getByRole('heading', { name: 'Anamnese' })).toBeVisible();
    await page.getByLabel(/Qual o motivo da consulta/).fill('Tosse e febre há dois dias');
    await page.getByLabel(/Tem alergia/).fill('Dipirona');
    await page.getByRole('radio', { name: 'Sim' }).first().click();
    await page.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(page.getByRole('heading', { name: 'Tudo certo! 💜' })).toBeVisible();
    await legendar(page, 'Enviado — o link não aceita novo preenchimento');
    await fechar();
  }

  // ───────── Ato 3b · clínica lê respostas e manda o termo ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}3b-ve-respostas-e-envia-termo.webm`, RAW, {
      viewport: DESKTOP,
      storageState: storage!,
    });
    await page.goto(clientPath);
    const docs = page.getByRole('region', { name: 'Documentos do paciente' });
    await expect(docs.getByText('Preenchido', { exact: true })).toBeVisible();
    await legendar(page, 'Na clínica: anamnese preenchida — alergia a dipirona aparece na ficha');
    await docs.getByRole('button', { name: /^Ver: Anamnese/ }).click();
    await expect(page.getByText('Tosse e febre há dois dias')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Dipirona', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await docs.getByRole('button', { name: 'Enviar' }).click();
    await legendar(page, 'Agora o termo de consentimento — a mãe lê e assina no celular');
    await page.locator('#doc-template').selectOption({ label: 'Termo de consentimento · Termo de consentimento' });
    await page.getByRole('button', { name: 'Gerar link' }).click();
    termoLink = await page.getByLabel('Link para o paciente').inputValue();
    storage = await page.context().storageState();
    await fechar();
  }

  // ───────── Ato 3c · mãe assina o termo ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}3c-mae-assina-termo.webm`, RAW, { ...devices['Pixel 7'] });
    await page.goto(termoLink.replace(/^https?:\/\/[^/]+/, ''));
    await legendar(page, 'Termo no celular: marcar o aceite e digitar o nome');
    await page.getByRole('checkbox').check();
    await page.getByLabel(/Nome completo/).fill('Mariana Costa');
    await page.getByRole('button', { name: 'Aceitar e enviar' }).click();
    await expect(page.getByRole('heading', { name: 'Tudo certo! 💜' })).toBeVisible();
    await legendar(page, 'Assinado — a clínica guarda o aceite com data e IP');
    await fechar();
  }

  // ───────── Ato 3d · ficha completa ─────────
  {
    const { page, fechar } = await ato(browser, `${PREFIX}3d-ficha-completa.webm`, RAW, {
      viewport: DESKTOP,
      storageState: storage!,
    });
    await page.goto(clientPath);
    const docs = page.getByRole('region', { name: 'Documentos do paciente' });
    await expect(docs.getByText('Preenchido', { exact: true })).toHaveCount(2);
    await legendar(page, 'Pronto: prontuário, anamnese e termo na mesma ficha do paciente');
    await fechar();
  }

  // Junta os atos num mp4 (desktop + trechos de celular escalados).
  try {
    const partes = readdirSync(VIDEOS)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith('.webm'))
      .sort();
    const filtros = partes
      .map((_, i) => `[${i}:v]scale=1366:860:force_original_aspect_ratio=decrease,pad=1366:860:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=25[v${i}]`)
      .join(';');
    const entradas = partes.flatMap((f) => ['-i', path.join(VIDEOS, f)]);
    const concat = `${partes.map((_, i) => `[v${i}]`).join('')}concat=n=${partes.length}:v=1:a=0[out]`;
    writeFileSync(path.join(RAW, 'lista.txt'), partes.join('\n'));
    execFileSync(
      'ffmpeg',
      ['-y', ...entradas, '-filter_complex', `${filtros};${concat}`, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', path.join(VIDEOS, `${PREFIX}completo.mp4`)],
      { stdio: 'ignore' },
    );
  } catch {
    /* sem ffmpeg: ficam os .webm */
  }
  rmSync(RAW, { recursive: true, force: true });
});
