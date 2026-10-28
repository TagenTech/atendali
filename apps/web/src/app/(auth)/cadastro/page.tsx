'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_COMMON_MESSAGE, PASSWORD_MIN_LENGTH, isCommonPassword, safeNext } from '@skedulei/contracts';
import { Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordInput, passwordStrength } from '@/components/auth/password-input';
import { SocialButtons, useSignupEnabled } from '@/components/auth/social-buttons';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { cn, haptic } from '@/lib/utils';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Como podemos te chamar?').max(120),
    email: z.string().trim().min(1, 'Informe seu e-mail').email('Esse e-mail não parece certo'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
      .max(128)
      .refine((v) => !isCommonPassword(v), PASSWORD_COMMON_MESSAGE),
    confirmPassword: z.string().min(1, 'Repita a senha'),
    acceptTerms: z.literal(true, { error: 'Aceite os termos para continuar' }),
  })
  .refine((v) => v.confirmPassword === v.password, {
    message: 'As senhas precisam ser iguais',
    path: ['confirmPassword'],
    // Mostra junto com os outros erros, mesmo antes de aceitar os termos.
    when: () => true,
  });
type FormValues = z.infer<typeof schema>;

export default function CadastroPage() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const signupEnabled = useSignupEnabled();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { acceptTerms: undefined as unknown as true } });
  const password = useWatch({ control, name: 'password' }) ?? '';
  const strength = passwordStrength(password);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await signUp({ name: v.name, email: v.email, password: v.password, acceptTerms: v.acceptTerms });
      haptic([15, 60, 25]);
      toast.success('Conta criada! Mandamos um link para confirmar seu e-mail 💌');
      // Quem veio de um convite volta para ele; os demais vão montar o próprio negócio.
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next'), '/onboarding'));
    } catch (err) {
      haptic([30, 40, 30]);
      setFormError(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível criar a conta agora.');
    }
  });

  if (!signupEnabled) {
    return (
      <AuthLayout title="Cadastro fechado" subtitle="No momento novas contas são criadas pelo administrador.">
        <Button asChild block size="lg">
          <Link href="/login">Voltar para entrar</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Comece grátis — leva menos de 1 minuto ✨">
      <div className="space-y-4">
        <SocialButtons label="Continuar" />
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Seu nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" autoComplete="name" autoCapitalize="words" placeholder="Como te chamam" icon={<User />} invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com" icon={<Mail />} invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Senha" htmlFor="password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`} invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field label="Confirmar senha" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <PasswordInput id="confirmPassword" autoComplete="new-password" placeholder="Repita a senha" invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          </Field>
          {password ? (
            <div className="-mt-2 flex items-center gap-2 pl-1" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      strength.score >= i ? (strength.score === 1 ? 'bg-warning' : 'bg-success') : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{strength.label}</span>
            </div>
          ) : null}
          <label className="flex items-start gap-3 rounded-2xl p-1 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" {...register('acceptTerms')} />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" className="font-semibold text-primary underline">
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" className="font-semibold text-primary underline">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms ? <p role="alert" className="-mt-2 pl-1 text-sm font-medium text-danger">{errors.acceptTerms.message}</p> : null}
          {formError ? (
            <div role="alert" className="animate-shake rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-soft-foreground">
              {formError}{' '}
              {formError.includes('já tem conta') ? (
                <Link href="/login" className="underline">
                  Entrar
                </Link>
              ) : null}
            </div>
          ) : null}
          <Button type="submit" size="lg" block loading={isSubmitting}>
            Criar minha conta
          </Button>
        </form>
        <p className="pt-2 text-center text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="font-bold text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
