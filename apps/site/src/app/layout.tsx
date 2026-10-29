import type { Metadata, Viewport } from 'next';
import { Inter, Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['600', '700', '800', '900'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Skedulei — agendamento e gestão para o seu negócio',
  description:
    'Agenda, agendamento online, comandas, caixa, comissões e financeiro para salões, barbearias, clínicas de estética, médicas, odontologia e terapias.',
  applicationName: 'Skedulei',
  metadataBase: new URL('https://www.skedulei.com.br'),
  openGraph: {
    title: 'Skedulei — agendamento e gestão para o seu negócio',
    description: 'Agenda, agendamento online, comandas, caixa, comissões e financeiro. Tudo em um só lugar.',
    url: 'https://www.skedulei.com.br',
    siteName: 'Skedulei',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/capa.png', width: 1200, height: 630 }],
  },
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8ff' },
    { media: '(prefers-color-scheme: dark)', color: '#17131f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
