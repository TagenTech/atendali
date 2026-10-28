'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordInput } from '@/components/auth/password-input';
import { SocialButtons, useSignupEnabled } from '@/components/auth/social-buttons';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@agendei/contracts';
import { MFA_TICKET_KEY } from '@/components/auth/mfa-code-form';
import { cn, haptic } from '@/lib/utils';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Esse e-mail não parece certo'),
  password: z.string().min(1, 'Informe sua senha'),
});
type FormValues = z.infer<typeof schema>;

/** Só códigos conhecidos viram mensagem — texto da URL nunca é exibido (evita phishing). */
const OAUTH_ERRORS: Record<string, string> = {
  cancelado: 'Login cancelado. Tente de novo quando quiser.',
  provedor: 'Esse jeito de entrar não está disponível.',
  falhou: 'Não deu para entrar com essa conta. Tente de novo.',
  email: 'Precisamos do seu e-mail: autorize o acesso ao e-mail na conta escolhida.',
  vincular: 'Esse e-mail já tem conta. Entre com e-mail e senha (ou recupere a senha).',
  fechado: 'O cadastro de novas contas está fechado no momento.',
};


export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const signupEnabled = useSignupEnabled();
  const erro = params.get('erro');
  const [formError, setFormError] = React.useState<string | null>(erro ? (OAUTH_ERRORS[erro] ?? OAUTH_ERRORS.falhou) : null);
  const [shakeKey, setShakeKey] = React.useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { mfaToken } = await login(values);
      if (mfaToken) {
        // O ticket fica só nesta aba (sessionStorage) e expira em 5 min.
        sessionStorage.setItem(MFA_TICKET_KEY, mfaToken);
        router.push(`/login/2fa?next=${encodeURIComponent(safeNext(params.get('next')))}`);
        return;
      }
      haptic(15);
      router.replace(safeNext(params.get('next')));
    } catch (err) {
      haptic([30, 40, 30]);
      setShakeKey((k) => k + 1);
      setFormError(
        err instanceof ApiError && err.status === 429
          ? 'Muitas tentativas. Respire fundo e tente em 1 minuto 🌿'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível entrar agora.',
      );
    }
  });

  return (
    <div className="space-y-4">
      <SocialButtons />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="voce@email.com"
            icon={<Mail />}
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" placeholder="Sua senha" invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/esqueci-senha" className="text-sm font-semibold text-primary">
            Esqueci minha senha
          </Link>
        </div>
        {formError ? (
          <div key={shakeKey} role="alert" className={cn('animate-shake rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-soft-foreground')}>
            {formError}
          </div>
        ) : null}
        <Button type="submit" size="lg" block loading={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      {signupEnabled ? (
        <p className="pt-2 text-center text-muted-foreground">
          Ainda não tem conta?{' '}
          <Link
            href={params.get('next') ? `/cadastro?next=${encodeURIComponent(safeNext(params.get('next')))}` : '/cadastro'}
            className="font-bold text-primary"
          >
            Criar conta grátis
          </Link>
        </p>
      ) : null}
    </div>
  );
}
