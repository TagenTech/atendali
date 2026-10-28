'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { verifyEmail } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type State = 'loading' | 'ok' | 'error';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = React.useState<State>(token ? 'loading' : 'error');
  const [message, setMessage] = React.useState('Link incompleto.');
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    verifyEmail(token)
      .then(() => setState('ok'))
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : 'Não foi possível confirmar agora.');
        setState('error');
      });
  }, [token]);

  if (state === 'loading') return <AuthLayout title="Confirmando…" subtitle="Só um instante." >{null}</AuthLayout>;
  return state === 'ok' ? (
    <AuthLayout title="E-mail confirmado! 🎉" subtitle="Tudo certo com a sua conta.">
      <Button asChild block size="lg">
        <Link href="/inicio">Ir para o Agendei</Link>
      </Button>
    </AuthLayout>
  ) : (
    <AuthLayout title="Não deu para confirmar" subtitle={message}>
      <div className="space-y-3">
        <Button asChild block size="lg">
          <Link href="/inicio">Abrir o Agendei</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">Lá dentro você pode pedir um novo link.</p>
      </div>
    </AuthLayout>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
