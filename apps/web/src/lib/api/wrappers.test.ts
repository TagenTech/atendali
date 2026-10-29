import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as agenda from './agenda';
import * as audit from './audit';
import * as clinico from './clinico';
import * as contact from './contact';
import * as finance from './finance';
import * as ledger from './ledger';
import * as org from './org';
import * as reports from './reports';
import * as retention from './retention';

/**
 * Cada função de `api/*` é uma linha que monta caminho + método + cabeçalho do negócio.
 * Este teste chama todas com argumentos de enchimento e confere o que saiu na rede: prefixo da API,
 * método válido e o `x-organization-id` nas rotas do negócio (as públicas não levam).
 */
const MODULES = { agenda, audit, clinico, contact, finance, ledger, org, reports, retention } as const;

const ARG_SETS: unknown[][] = [
  ['org-1', 'x', 'x', 'x'],
  ['org-1', { date: '2026-03-10', serviceId: 's', memberId: 'm', from: '2026-03-01', to: '2026-03-31' }, 'x'],
  ['org-1', ['a', 'b'], 'x'],
  ['slug', '2026-03-10', ['a', 'b']],
  [{ x: 1 }, { x: 1 }, { x: 1 }],
];

const PUBLIC = /^(public|portal|invite)|Public|portal|invite|contact|send/i;

describe('api/* chama a rota certa', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  for (const [modName, mod] of Object.entries(MODULES)) {
    for (const [fnName, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue;
      it(`${modName}.${fnName}`, async () => {
        let ok = false;
        for (const args of ARG_SETS) {
          fetchMock.mockClear();
          try {
            await (fn as (...a: unknown[]) => Promise<unknown>)(...args.slice(0, Math.max(fn.length, 1)));
            ok = true;
            break;
          } catch {
            /* argumentos de outro formato: tenta o próximo conjunto */
          }
        }
        expect(ok, `nenhum conjunto de argumentos serviu para ${fnName}`).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url.startsWith('/api/v1/')).toBe(true);
        expect([undefined, 'GET', 'POST', 'PATCH', 'PUT', 'DELETE']).toContain(init.method);
        const headers = new Headers(init.headers);
        if (url.includes('/org/') && !PUBLIC.test(fnName) && !url.includes('/public/')) expect(headers.get('x-organization-id')).toBeTruthy();
        if (init.body) expect(() => JSON.parse(String(init.body))).not.toThrow();
      });
    }
  }
});
