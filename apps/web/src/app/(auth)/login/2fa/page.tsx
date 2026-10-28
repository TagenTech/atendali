'use client';

import { safeNext } from '@agendei/contracts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { MFA_TICKET_KEY, MfaCodeForm } from '@/components/auth/mfa-code-form';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';
import { haptic } from '@/lib/utils';

/** Ticket vem do login por senha (sessionStorage) ou do login social (#t= na URL, nunca enviado ao servidor). */
function readTicket(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('t');
  if (fromHash) {
    sessionStorage.setItem(MFA_TICKET_KEY, fromHash);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return fromHash;
  }
  return sessionStorage.getItem(MFA_TICKET_KEY);
}

function SecondStep() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { completeMfa } = useAuth();
  const [ticket] = React.useState(() => (typeof window === 'undefined' ? null : readTicket()));
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (!hydrated) return null;
  if (!ticket) {
    return (
      <AuthLayout title="Sessão expirada" subtitle="Entre de novo para receber um novo pedido de código.">
        <Button asChild block size="lg">
          <Link href="/login">Entrar</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verificação em duas etapas 🔐" subtitle="Abra seu app autenticador e digite o código do Agendei.">
      <MfaCodeForm
        loading={loading}
        error={error}
        submitLabel="Entrar"
        onSubmit={async (code) => {
          setLoading(true);
          setError(null);
          try {
            await completeMfa(ticket, code);
            sessionStorage.removeItem(MFA_TICKET_KEY);
            haptic(15);
            router.replace(safeNext(params.get('next')));
          } catch (err) {
            haptic([30, 40, 30]);
            const msg = err instanceof ApiError ? err.message : 'Não foi possível verificar agora.';
            setError(msg);
            if (msg.includes('tempo')) sessionStorage.removeItem(MFA_TICKET_KEY);
          } finally {
            setLoading(false);
          }
        }}
      />
      <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground">
        Voltar para o login
      </Link>
    </AuthLayout>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <SecondStep />
    </Suspense>
  );
}
