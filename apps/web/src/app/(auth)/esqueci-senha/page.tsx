'use client';

import { Mail } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { forgotPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (sent) {
    return (
      <AuthLayout title="Confira seu e-mail 💌" subtitle={`Se ${email} tiver conta, você vai receber um link para criar uma senha nova. Ele vale por 1 hora.`}>
        <div className="space-y-3">
          <Button asChild block size="lg">
            <Link href="/login">Voltar para entrar</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">Não chegou? Olhe o spam ou tente de novo em alguns minutos.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Esqueceu a senha?" subtitle="Acontece! Informe seu e-mail que mandamos um link.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Esse e-mail não parece certo');
            return;
          }
          setLoading(true);
          setError(null);
          try {
            await forgotPassword(email.trim());
            setSent(true);
          } catch (err) {
            setError(err instanceof ApiError && err.status === 429 ? 'Muitas tentativas. Tente mais tarde.' : 'Não foi possível enviar agora.');
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="E-mail" htmlFor="email" error={error ?? undefined}>
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!error} />
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          Enviar link
        </Button>
        <p className="text-center">
          <Link href="/login" className="text-sm font-semibold text-primary">
            Lembrei! Voltar para entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
