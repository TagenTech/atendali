import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Inter, Nunito } from 'next/font/google';
import { themeInitScript } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['600', '700', '800', '900'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Agendei', template: '%s · Agendei' },
  description: 'Agendamento, equipe e financeiro para salões, clínicas e consultórios.',
  applicationName: 'Agendei',
  appleWebApp: { capable: true, title: 'Agendei', statusBarStyle: 'default' },
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
    { media: '(prefers-color-scheme: light)', color: '#fbf8ff' },
    { media: '(prefers-color-scheme: dark)', color: '#17131f' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce da CSP (gerado no proxy.ts por requisição).
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
