'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { sendContact } from '@/lib/api/contact';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  name: z.string().trim().min(2, 'Como podemos te chamar?').max(120),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Esse e-mail não parece certo'),
  message: z.string().trim().min(10, 'Conte um pouco mais para a gente').max(2000),
});
type FormValues = z.infer<typeof schema>;

export default function ContatoPage() {
  const { user } = useAuth();
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Preenche nome/e-mail de quem já está logado, sem sobrescrever o que a pessoa digitou.
  React.useEffect(() => {
    if (!user) return;
    if (!getValues('name')) setValue('name', user.name);
    if (!getValues('email')) setValue('email', user.email);
  }, [user, getValues, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await sendContact(v);
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 429
          ? 'Muitas mensagens seguidas. Tente de novo mais tarde.'
          : err instanceof ApiError && err.details?.length
            ? err.details[0]
            : 'Não foi possível enviar agora. Tente de novo daqui a pouco.',
      );
    }
  });

  if (sent) {
    return (
      <AuthLayout title="Mensagem enviada 💌" subtitle="Recebemos seu contato e respondemos no seu e-mail assim que possível.">
        <Button asChild block size="lg">
          <Link href="/">Voltar para o início</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Fale com a gente" subtitle="Um problema, dúvida ou sugestão? Conta aqui que respondemos por e-mail.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Seu nome" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" autoCapitalize="words" placeholder="Como te chamam" icon={<User />} invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com" icon={<Mail />} invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Mensagem" htmlFor="message" error={errors.message?.message}>
          <Textarea id="message" placeholder="O que está acontecendo?" invalid={!!errors.message} {...register('message')} />
        </Field>
        {formError ? (
          <div role="alert" className="animate-shake rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-soft-foreground">
            {formError}
          </div>
        ) : null}
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Enviar mensagem
        </Button>
      </form>
    </AuthLayout>
  );
}
