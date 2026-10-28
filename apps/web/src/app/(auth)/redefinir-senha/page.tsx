'use client';

import { passwordProblem } from '@agendei/contracts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { resetPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [pw, setPw] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (!token) {
    return (
      <AuthLayout title="Link incompleto" subtitle="Abra o link direto do e-mail ou peça um novo.">
        <Button asChild block size="lg">
          <Link href="/esqueci-senha">Pedir novo link</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha que você vá lembrar 🔐">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const problem = passwordProblem(pw);
          if (problem) return (setPwError(problem), setError(null));
          setPwError(null);
          if (pw !== confirm) return setError('As senhas não batem');
          setLoading(true);
          setError(null);
          try {
            await resetPassword(token, pw);
            toast.success('Senha alterada! Entre com a nova senha ✨');
            router.replace('/login');
          } catch (err) {
            setError(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível alterar agora.');
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="Nova senha" htmlFor="pw" error={pwError ?? undefined}>
          <PasswordInput id="pw" autoComplete="new-password" value={pw} onChange={(e) => (setPw(e.target.value), setPwError(null))} invalid={!!pwError} />
        </Field>
        <Field label="Repita a senha" htmlFor="pw2" error={error ?? undefined}>
          <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!error} />
        </Field>
        {error?.includes('Link') ? (
          <Link href="/esqueci-senha" className="block text-center text-sm font-semibold text-primary">
            Pedir novo link
          </Link>
        ) : null}
        <Button type="submit" block size="lg" loading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
