import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Testes unitários do navegador: lógica (src/lib: formatação, cliente da API, sessão, tema, PWA...) e os componentes
 * de dinheiro, agenda, reserva pública e cadastros (src/components/finance, agenda, public e org, com Testing Library). As demais telas e os fluxos de ponta
 * a ponta são cobertos pelo Playwright (`pnpm test:e2e`).
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/finance/**/*.{ts,tsx}', 'src/components/agenda/**/*.{ts,tsx}', 'src/components/public/**/*.{ts,tsx}', 'src/components/org/**/*.{ts,tsx}'],
      // Hooks de react-query: só repassam o cache para as chamadas de api/*; as telas que os usam rodam no Playwright.
      exclude: ['src/lib/queries/**', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'text-summary', 'json-summary'],
      // Limite por pasta: o 99% de src/lib não pode esconder uma tela sem teste.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
        'src/lib/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/components/finance/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/components/agenda/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/components/public/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/components/org/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
