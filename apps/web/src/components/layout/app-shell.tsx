'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/lib/auth';
import { OrgProvider, useOrgState } from '@/lib/org';
import { BottomNav } from './bottom-nav';
import { ConnectivityBanner } from './connectivity-banner';
import { Sidebar } from './sidebar';

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
      <LogoMark className="size-16 animate-pulse" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status === 'unavailable') {
    return (
      <EmptyState
        className="min-h-dvh justify-center"
        emoji="🔌"
        title="Não deu para conectar"
        description="O servidor não respondeu agora. Sua sessão continua salva."
        action={<Button onClick={() => window.location.reload()}>Tentar de novo</Button>}
      />
    );
  }
  return status === 'authenticated' ? <OrgGate>{children}</OrgGate> : <Splash />;
}

/** Só mostra o app com um negócio ativo; sem negócio, vai montar o primeiro. */
function OrgGate({ children }: { children: React.ReactNode }) {
  const state = useOrgState();
  const router = useRouter();
  // Telas de formulário ocupam a tela toda no celular, sem barra inferior.
  const pathname = usePathname();
  const immersive = /^\/mais\/(perfil|seguranca)$/.test(pathname);
  // Painel de TV: tela cheia, sem menu.
  const fullscreen = pathname === '/tv';

  React.useEffect(() => {
    if (state.status === 'none') router.replace('/onboarding');
  }, [state.status, router]);

  if (state.status === 'error') {
    return (
      <EmptyState
        className="min-h-dvh justify-center"
        emoji="🔌"
        title="Não deu para carregar"
        description="Confira sua internet e tente de novo."
        action={<Button onClick={state.retry}>Tentar de novo</Button>}
      />
    );
  }
  if (state.status !== 'ready') return <Splash />;

  if (fullscreen) return <OrgProvider value={state.value}>{children}</OrgProvider>;

  return (
    <OrgProvider value={state.value}>
      <div className="min-h-dvh pt-safe lg:pl-72">
        <ConnectivityBanner />
        <Sidebar />
        {immersive ? (
          <main className="mx-auto max-w-lg lg:max-w-2xl lg:py-6">{children}</main>
        ) : (
          <>
            <main className="mx-auto max-w-lg pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:max-w-6xl lg:px-6 lg:pb-12">{children}</main>
            <BottomNav />
          </>
        )}
      </div>
    </OrgProvider>
  );
}
