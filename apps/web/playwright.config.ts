import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de navegador dos fluxos principais.
 * Sobe uma API e um web próprios (portas 3210/3211) com um banco zerado a cada execução,
 * sem mexer no banco nem nos servidores de desenvolvimento.
 *   pnpm --filter @skedulei/web test:e2e            (E2E_SKIP_BUILD=1 reaproveita o último build)
 */
const API_PORT = 3210;
const WEB_PORT = 3211;
const DATABASE_URL = process.env.E2E_WEB_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/skedulei_e2e_web';
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Os fluxos contam uma história (cadastro → onboarding → serviços → equipe) numa conta por projeto.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: [
    {
      name: 'api',
      cwd: '../api',
      command: `node test/reset-db.js ${DATABASE_URL} && pnpm exec ts-node -r tsconfig-paths/register src/main.ts`,
      url: `http://localhost:${API_PORT}/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL,
        TYPEORM_SYNC: 'true',
        TS_NODE_TRANSPILE_ONLY: '1',
        JWT_SECRET: 'playwright-secret-playwright-secret-0001',
        DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        PUBLIC_WEB_URL: WEB_URL,
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
        RESEND_API_KEY: '',
        GOOGLE_CLIENT_ID: '',
        MICROSOFT_CLIENT_ID: '',
        FACEBOOK_CLIENT_ID: '',
        SIGNUP_ENABLED: 'true',
        THROTTLE_LIMIT: '5000',
        REGISTER_THROTTLE_LIMIT: '1000',
      },
    },
    {
      name: 'web',
      command: process.env.E2E_SKIP_BUILD
        ? `pnpm exec next start -p ${WEB_PORT}`
        : `pnpm exec next build && pnpm exec next start -p ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { NEXT_DIST_DIR: '.next-e2e', API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
