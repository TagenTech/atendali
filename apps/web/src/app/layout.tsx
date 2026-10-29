import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Schibsted_Grotesk } from 'next/font/google';
import { themeInitScript } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

// Família única (grotesca de leitura editorial), do corpo aos títulos pesados.
const schibsted = Schibsted_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-schibsted' });

export const metadata: Metadata = {
  title: { default: 'Skedulei', template: '%s · Skedulei' },
  description: 'Agendamento, equipe e financeiro para salões, clínicas e consultórios.',
  applicationName: 'Skedulei',
  appleWebApp: { capable: true, title: 'Skedulei', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d191e' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce da CSP (gerado no proxy.ts por requisição).
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="pt-BR" className={schibsted.variable} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
