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
    background_color: '#fbf8ff',
    theme_color: '#fbf8ff',
    categories: ['education', 'productivity', 'finance'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
