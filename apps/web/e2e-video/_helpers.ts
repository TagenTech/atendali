import { type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

export const VIDEOS = path.resolve(__dirname, '../videos');
export const DESKTOP = { width: 1366, height: 860 };

/** Faixa de legenda que sobrevive às navegações. */
export async function legendar(page: Page, texto: string) {
  await page.evaluate((t) => {
    sessionStorage.setItem('__legenda', t);
    document.getElementById('__legenda')?.remove();
    const el = document.createElement('div');
    el.id = '__legenda';
    el.textContent = t;
    el.setAttribute(
      'style',
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:92vw;z-index:2147483647;background:rgba(17,24,39,.92);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:14px;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35)',
    );
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
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:92vw;z-index:2147483647;background:rgba(17,24,39,.92);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:14px;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35)',
      );
      document.body.appendChild(el);
    });
  });

/** Apaga só os arquivos deste fluxo (não mexe nos outros vídeos da pasta). */
export function limparSaida(deveApagar: (name: string) => boolean, rawDir: string) {
  mkdirSync(VIDEOS, { recursive: true });
  for (const f of readdirSync(VIDEOS)) {
    if (deveApagar(f)) rmSync(path.join(VIDEOS, f), { recursive: true, force: true });
  }
  mkdirSync(rawDir, { recursive: true });
}

/** Abre um contexto gravando vídeo e devolve a página + como fechar salvando o arquivo. */
export async function ato(browser: Browser, outFile: string, rawDir: string, opts: Parameters<Browser['newContext']>[0] = {}) {
  const size = opts.viewport ?? DESKTOP;
  const ctx = await browser.newContext({
    ...opts,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: { dir: rawDir, size },
  });
  await prepararLegendas(ctx);
  const page = await ctx.newPage();
  return {
    ctx,
    page,
    fechar: async () => {
      const video = page.video();
      await ctx.close();
      await video?.saveAs(path.join(VIDEOS, outFile));
    },
  };
}
