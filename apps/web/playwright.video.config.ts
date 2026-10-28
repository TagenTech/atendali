import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Grava vídeos do fluxo completo (clínica pediátrica) — fora da suíte de regressão.
 *   pnpm --filter @agendei/web video            (E2E_SKIP_BUILD=1 reaproveita o último build)
 * Os vídeos ficam em apps/web/videos/.
 */
export default defineConfig({
  ...base,
  testDir: './e2e-video',
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  projects: [{ name: 'video' }],
  use: { ...base.use, launchOptions: { slowMo: Number(process.env.VIDEO_SLOWMO ?? 450) } },
});
