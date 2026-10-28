'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_COMMON_MESSAGE, PASSWORD_MIN_LENGTH, isCommonPassword } from '@agendei/contracts';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { changePassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';

const buildSchema = (hasPassword: boolean) =>
  z
  .object({
    currentPassword: hasPassword ? z.string().min(1, 'Informe a senha atual') : z.string(),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
      .refine((v) => !isCommonPassword(v), PASSWORD_COMMON_MESSAGE),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não batem', when: () => true });
type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function ChangePasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { logout, user } = useAuth();
  // Quem entrou só com Google/Microsoft/Meta ainda não tem senha: cria uma sem informar a atual.
  const hasPassword = user?.hasPassword !== false;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(React.useMemo(() => buildSchema(hasPassword), [hasPassword])) });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword(hasPassword ? { currentPassword, newPassword } : { newPassword });
      toast.success('Senha alterada! Entre de novo com a nova senha 🔐');
      onOpenChange(false);
      await logout();
    } catch (err) {
      setError('currentPassword', {
        message: err instanceof ApiError ? err.message : 'Não foi possível alterar agora',
      });
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={hasPassword ? 'Alterar senha' : 'Criar senha'}
      description={hasPassword ? 'Por segurança, todas as sessões serão encerradas.' : 'Para entrar também com e-mail e senha, além da sua conta social.'}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {hasPassword ? (
          <Field label="Senha atual" htmlFor="currentPassword" error={errors.currentPassword?.message}>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
              {...register('currentPassword')}
            />
          </Field>
        ) : null}
        <Field
          label="Nova senha"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
          hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.newPassword}
            {...register('newPassword')}
          />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirm}
            {...register('confirm')}
          />
        </Field>
        <Button type="submit" block loading={isSubmitting}>
          Salvar nova senha
        </Button>
      </form>
    </Sheet>
  );
}
