'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { deleteAccount } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';

export function DeleteAccountSection() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  if (!user) return null;

  return (
    <Card className="space-y-3 border-danger/30">
      <p className="font-display font-extrabold text-danger">Excluir minha conta</p>
      <p className="text-sm text-muted-foreground">
        Apaga para sempre sua conta. Negócios em que você é a única pessoa com acesso são apagados junto (serviços, equipe, unidades). Antes, baixe uma
        cópia em Mais → Meus dados.
      </p>
      <Button variant="danger" block onClick={() => setOpen(true)}>
        <Trash2 /> Excluir conta
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Excluir conta para sempre?" description="Não dá para desfazer.">
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await deleteAccount({
                confirmEmail: email.trim(),
                password: user.hasPassword ? password : undefined,
                code: user.mfaEnabled ? code.trim() : undefined,
              });
              toast('Conta excluída. Sentiremos sua falta 💜');
              router.replace('/login');
              setTimeout(() => window.location.reload(), 300);
            } catch (err) {
              setError(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível excluir agora');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label={`Digite seu e-mail (${user.email})`} htmlFor="del-email">
            <Input id="del-email" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {user.hasPassword ? (
            <Field label="Sua senha" htmlFor="del-pw">
              <PasswordInput id="del-pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          ) : null}
          {user.mfaEnabled ? (
            <Field label="Código do app autenticador" htmlFor="del-code">
              <Input id="del-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          ) : null}
          {error ? <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-soft-foreground">{error}</p> : null}
          <Button type="submit" variant="danger" block size="lg" loading={loading} disabled={email.trim().toLowerCase() !== user.email.toLowerCase()}>
            Excluir definitivamente
          </Button>
        </form>
      </Sheet>
    </Card>
  );
}
