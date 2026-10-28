import { ORG_HEADER, type ApiError as ApiErrorBody, type AuthResponse } from '@skedulei/contracts';

/** O navegador chama sempre a mesma origem; o Next (dev) / nginx (prod) repassa para a API. */
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

// Access token só em memória (nunca em localStorage). Ao recarregar a página,
// a sessão volta pelo cookie httpOnly de refresh.
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionExpired: (() => void) | null = null;
/** Negócio ativo: vai no header de toda chamada (as rotas /org/* exigem). */
let activeOrgId: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setActiveOrganization(id: string | null) {
  activeOrgId = id;
}

export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.message ?? 'Não foi possível falar com o servidor',
      err?.details,
    );
  }
  return body as T;
}

/** Servidor indisponível (sem rede, 429, 5xx) ao renovar: a sessão pode estar boa — não é para deslogar. */
export class SessionUnavailableError extends Error {}

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renova a sessão pelo cookie. Chamadas simultâneas compartilham a mesma requisição.
 * `null` = sessão expirada (401/403). Falha passageira (sem rede, 429, 5xx) tenta de novo com espera
 * e, se persistir, lança `SessionUnavailableError` — tratar como "sem sessão" mandaria para o login,
 * e o proxy (que vê o cookie) devolveria para o app, num vaivém.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      try {
        res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
      } catch {
        res = null;
      }
      if (res?.ok) {
        const data = await parse<AuthResponse>(res);
        accessToken = data.accessToken;
        return data;
      }
      if (res && (res.status === 401 || res.status === 403)) return null;
      if (attempt >= RETRY_DELAYS_MS.length) throw new SessionUnavailableError('Não foi possível falar com o servidor');
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (activeOrgId && !headers.has(ORG_HEADER)) headers.set(ORG_HEADER, activeOrgId);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Sem conexão. Confira sua internet.');
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession().catch(() => undefined);
    if (session) return api<T>(path, init, false);
    // undefined = servidor indisponível: devolve o erro sem deslogar.
    if (session === null) {
      accessToken = null;
      onSessionExpired?.();
    }
  }
  return parse<T>(res);
}

/** Baixa um arquivo autenticado (ex.: CSV) e dispara o download no navegador. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const go = () =>
    fetch(`${BASE}${path}`, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: 'same-origin',
    });
  let res = await go();
  if (res.status === 401 && (await refreshSession().catch(() => null))) res = await go();
  if (!res.ok) throw new ApiError(res.status, 'Não foi possível exportar');
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Texto amigável de um erro de API (primeiro detalhe de validação, se houver). */
export function errorText(err: unknown, fallback = 'Não foi possível salvar'): string {
  return err instanceof ApiError ? (err.details?.[0] ?? err.message) : fallback;
}

/** Endereço de uma imagem pública que a API devolve relativo à raiz (`/public/orgs/…`). */
export const apiAsset = (path: string | null | undefined) => (path ? `/api/v1${path}` : undefined);
