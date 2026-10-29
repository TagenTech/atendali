import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Skedulei — Agendamento e gestão',
    short_name: 'Skedulei',
    description: 'Agendamento, equipe e financeiro para salões, clínicas e consultórios.',
    lang: 'pt-BR',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f7f6',
    theme_color: '#f4f7f6',
    categories: ['business', 'productivity', 'health'],
    shortcuts: [
      { name: 'Agenda', url: '/agenda', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Clientes', url: '/clientes', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Caixa', url: '/caixa', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
