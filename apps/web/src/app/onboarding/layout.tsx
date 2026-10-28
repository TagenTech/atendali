'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

/** Onboarding fica fora do shell do app (ainda não há negócio), mas exige login. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login?next=/onboarding');
  }, [status, router]);

  if (status === 'unavailable') {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="space-y-4">
          <p className="font-display text-xl font-extrabold">Não deu para conectar</p>
          <p className="text-muted-foreground">O servidor não respondeu agora. Sua sessão continua salva.</p>
          <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        </div>
      </div>
    );
  }
  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
        <LogoMark className="size-16 animate-pulse" />
      </div>
    );
  }
  return <div className="min-h-dvh pt-safe">{children}</div>;
}
