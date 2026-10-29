import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'skedulei_refresh';
/** Telas de entrada: com sessão, vai direto para o app. */
const ENTRY = ['/login', '/cadastro', '/esqueci-senha'];
/** Área logada. */
const PROTECTED = ['/inicio', '/agenda', '/clientes', '/caixa', '/financeiro', '/relatorios', '/comissoes', '/servicos', '/estoque', '/fidelidade', '/avaliacoes', '/atividade', '/tv', '/equipe', '/configuracoes', '/mais', '/onboarding'];

const isDev = process.env.NODE_ENV === 'development';

/**
 * CSP estrita com nonce por requisição: só roda script com o nonce (Next aplica nos dele;
 * o layout aplica no script de tema). 'strict-dynamic' deixa esses scripts carregarem os chunks.
 * Estilos ficam com 'unsafe-inline' porque o app usa atributos style (nonce não cobre atributos).
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:", // confete (canvas-confetti) desenha num worker criado pelo próprio script
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * 1) Gera o nonce e a CSP de cada página.
 * 2) Checagem otimista de sessão (só olha se o cookie existe, para não piscar a tela errada);
 *    a validação de verdade acontece na API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  // A raiz é a página comercial: com sessão, vai direto para o app.
  if ((ENTRY.includes(pathname) || pathname === '/') && hasSession) return NextResponse.redirect(new URL('/inicio', request.url));
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas (não a API, arquivos estáticos, ícones, manifest e service worker).
      source: '/((?!api|_next/static|_next/image|icons|favicon|icon.svg|manifest.webmanifest|sw.js).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
