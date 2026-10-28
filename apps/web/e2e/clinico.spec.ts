import { expect, test } from '@playwright/test';
import { createBusiness, expectClean, expectNoHorizontalScroll, watch } from './helpers';

const stamp = `cl${Date.now().toString(36)}`;

test.describe('módulo clínico: prontuário, anamnese e termo', () => {
  test('a clínica anota no prontuário, envia a anamnese e o termo e vê o que o paciente respondeu', async ({ browser, page, context }) => {
    const seen = watch(page);
    const org = await createBusiness(context, stamp, 'CLINICA_MEDICA');
    const headers = { authorization: `Bearer ${org.owner.token}`, 'x-organization-id': org.id };
    await context.request.patch('/api/v1/org', { headers, data: { features: ['ANAMNESE', 'TERMOS', 'PRONTUARIO'] } });
    const client = await (await context.request.post('/api/v1/org/clients', { headers, data: { name: 'Sofia Costa', phone: '11988887777' } })).json();

    await page.goto(`/clientes/${client.id}`);
    // ---- prontuário
    const prontuario = page.getByRole('region', { name: 'Prontuário' });
    await expect(prontuario.getByText('Nenhuma anotação ainda.')).toBeVisible();
    await prontuario.getByRole('button', { name: 'Nova anotação' }).click();
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Escreva a anotação')).toBeVisible();
    await page.getByLabel('Evolução').fill('Febre há 2 dias. Orientado repouso e hidratação.');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Anotação salva')).toBeVisible();
    await expect(prontuario.getByText('Febre há 2 dias. Orientado repouso e hidratação.')).toBeVisible();
    if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'ficha com prontuário');

    // ---- anamnese pelo link do paciente
    const docs = page.getByRole('region', { name: 'Documentos do paciente' });
    await docs.getByRole('button', { name: 'Enviar' }).click();
    await page.locator('#doc-template').selectOption({ label: 'Ficha de anamnese · Anamnese' });
    await page.getByRole('button', { name: 'Gerar link' }).click();
    const link = await page.getByLabel('Link para o paciente').inputValue();
    expect(link).toMatch(/\/documento\/[\w-]+$/);
    await page.keyboard.press('Escape');

    const mae = await browser.newContext();
    const paciente = await mae.newPage();
    const pSeen = watch(paciente);
    await paciente.goto(link.replace(/^https?:\/\/[^/]+/, ''));
    await expect(paciente.getByRole('heading', { name: 'Anamnese' })).toBeVisible();
    await paciente.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(paciente.getByText('Responda: Qual o motivo da consulta?')).toBeVisible();
    await paciente.getByLabel(/Qual o motivo da consulta/).fill('Tosse e febre');
    await paciente.getByLabel(/Tem alergia/).fill('Dipirona');
    await paciente.getByRole('radio', { name: 'Sim' }).first().click();
    await paciente.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(paciente.getByRole('heading', { name: 'Tudo certo! 💜' })).toBeVisible();
    // Link já usado: não mostra mais as perguntas.
    await paciente.reload();
    await expect(paciente.getByRole('heading', { name: 'Tudo certo! 💜' })).toBeVisible();
    expectClean(pSeen, 'link do paciente');
    await mae.close();

    // A clínica vê "Preenchido" e as respostas.
    await page.reload();
    const doc = page.getByRole('region', { name: 'Documentos do paciente' });
    await expect(doc.getByText('Preenchido', { exact: true })).toBeVisible();
    await doc.getByRole('button', { name: /^Ver: Anamnese/ }).click();
    await expect(page.getByText('Tosse e febre')).toBeVisible();
    await expect(page.getByText('Dipirona')).toBeVisible();
    await page.keyboard.press('Escape');

    // ---- termo: exige aceite e nome
    await doc.getByRole('button', { name: 'Enviar' }).click();
    await page.locator('#doc-template').selectOption({ label: 'Termo de consentimento · Termo de consentimento' });
    await page.getByRole('button', { name: 'Gerar link' }).click();
    const termoLink = await page.getByLabel('Link para o paciente').inputValue();
    await page.keyboard.press('Escape');
    const t = await browser.newContext();
    const tp = await t.newPage();
    await tp.goto(termoLink.replace(/^https?:\/\/[^/]+/, ''));
    await tp.getByRole('button', { name: 'Aceitar e enviar' }).click();
    await expect(tp.getByText('Marque que você leu e concorda')).toBeVisible();
    await tp.getByRole('checkbox').check();
    await tp.getByRole('button', { name: 'Aceitar e enviar' }).click();
    await expect(tp.getByText('Digite o nome completo')).toBeVisible();
    await tp.getByLabel(/Nome completo/).fill('Mariana Costa');
    await tp.getByRole('button', { name: 'Aceitar e enviar' }).click();
    await expect(tp.getByRole('heading', { name: 'Tudo certo! 💜' })).toBeVisible();
    await t.close();
    expectClean(seen, 'ficha clínica');
  });

  test('configurações: modelos de ficha editáveis e módulos sem tela aparecem como "Em breve"', async ({ page, context }) => {
    const org = await createBusiness(context, `${stamp}b`, 'CLINICA_MEDICA');
    await context.request.patch('/api/v1/org', { headers: { authorization: `Bearer ${org.owner.token}`, 'x-organization-id': org.id }, data: { features: ['ANAMNESE', 'TERMOS', 'PRONTUARIO'] } });
    await page.goto('/configuracoes');
    if (test.info().project.name === 'celular') await expectNoHorizontalScroll(page, 'configurações com modelos'); // a tabela de taxas já alargou esta tela
    // Os modelos de exemplo aparecem sozinhos e dá para renomear.
    await page.getByRole('button', { name: 'Editar Anamnese' }).click();
    await page.getByLabel('Nome do modelo').fill('Anamnese pediátrica');
    await page.getByRole('button', { name: 'Adicionar pergunta' }).click();
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect(page.getByText('Informe', { exact: false }).or(page.getByText('Toda pergunta precisa de um texto'))).toBeVisible();
    await page.getByLabel('Pergunta 9', { exact: true }).fill('Frequenta creche?');
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect(page.getByText('Modelo salvo')).toBeVisible();
    await expect(page.getByText('Anamnese pediátrica')).toBeVisible();

    const fotos = page.getByRole('switch', { name: /Fotos antes e depois/ });
    await expect(fotos).toBeDisabled();
    await expect(page.getByText('Em breve').first()).toBeVisible();
  });
});
