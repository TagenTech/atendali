// Capturas para revisão visual (dev). Uso: node scripts/shots.mjs <pasta> [segmento] [rotas separadas por vírgula]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '/tmp/shots/antes';
const segment = process.argv[3] ?? 'clinica-medica';
const only = process.argv[4]?.split(',');
const BASE = process.env.BASE ?? 'http://localhost:3201';
mkdirSync(out, { recursive: true });

const sizes = { desktop: { width: 1440, height: 900 }, celular: { width: 390, height: 844 } };
const publicRoutes = ['/', '/login', '/cadastro', `/demo-${segment}`, '/contato', '/termos'];
const appRoutes = ['/inicio', '/agenda', '/clientes', '/servicos', '/equipe', '/caixa', '/financeiro', '/relatorios', '/configuracoes', '/mais', '/comissoes', '/estoque', '/fidelidade', '/avaliacoes', '/atividade', '/configuracoes?aba=agendamento', '/configuracoes?aba=unidades', '/configuracoes?aba=pagamentos', '/configuracoes?aba=modulos'];

const browser = await chromium.launch();
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: process.env.SCHEME ?? 'light' });
  if (process.env.SCHEME === 'dark') await ctx.addInitScript(() => localStorage.setItem('skedulei_theme', 'dark'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  const shot = async (route) => {
    if (only && !only.includes(route)) return;
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(600);
    const file = `${out}/${name}${route.replace(/[\/?=]/g, '_') || '_raiz'}.png`;
    await page.screenshot({ path: file, fullPage: route !== '/agenda' });
    console.log(name, route, '→', file);
  };
  for (const r of publicRoutes) await shot(r);
  await page.goto(BASE + '/login');
  await page.getByLabel('E-mail').fill(`demo-${process.env.EMAIL_SEG ?? segment}@skedulei.test`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/inicio/, { timeout: 20000 });
  for (const r of appRoutes) await shot(r);
  if (errors.length) console.log(name, 'erros de console:', [...new Set(errors)]);
  await ctx.close();
}
await browser.close();
