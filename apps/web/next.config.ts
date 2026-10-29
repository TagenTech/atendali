import path from 'node:path';
import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const API_URL = process.env.API_URL ?? 'http://localhost:3200';

// A CSP (com nonce por requisição) é definida no src/proxy.ts.
const SECURITY_HEADERS = [
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  // Testes de navegador compilam numa pasta própria (não atrapalha o `next dev`).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // O selo do Next no canto inferior esquerdo cobria o ícone "Início" da barra do celular.
  devIndicators: { position: 'top-right' },
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  // O navegador fala só com o web (mesma origem): o cookie de refresh fica SameSite=Strict
  // e não precisamos de CORS. Em produção o nginx faz o mesmo roteamento.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/v1/:path*` }];
  },
};

export default nextConfig;
