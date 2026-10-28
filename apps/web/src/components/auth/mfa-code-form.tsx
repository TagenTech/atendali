'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const MFA_TICKET_KEY = 'agendei_mfa_ticket';

/** Campo do código de 6 dígitos (com troca para código de recuperação). */
export function MfaCodeForm({
  onSubmit,
  submitLabel = 'Confirmar',
  error,
  loading,
  allowRecovery = true,
}: {
  onSubmit: (code: string) => void;
  submitLabel?: string;
  error?: string | null;
  loading?: boolean;
  allowRecovery?: boolean;
}) {
  const [recovery, setRecovery] = React.useState(false);
  const [code, setCode] = React.useState('');
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code.trim());
      }}
    >
      <Field
        label={recovery ? 'Código de recuperação' : 'Código do app autenticador'}
        htmlFor="mfa-code"
        error={error ?? undefined}
        hint={recovery ? 'Formato XXXX-XXXX. Cada código funciona uma vez.' : '6 números, mudam a cada 30 segundos.'}
      >
        <Input
          id="mfa-code"
          autoFocus
          autoComplete="one-time-code"
          inputMode={recovery ? 'text' : 'numeric'}
          autoCapitalize={recovery ? 'characters' : 'none'}
          maxLength={recovery ? 9 : 6}
          placeholder={recovery ? 'XXXX-XXXX' : '000000'}
          icon={recovery ? <KeyRound /> : <ShieldCheck />}
          value={code}
          onChange={(e) => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
          className={cn(!recovery && 'tracking-[0.4em]')}
          invalid={!!error}
        />
      </Field>
      <Button type="submit" block size="lg" loading={loading} disabled={recovery ? code.length < 8 : code.length !== 6}>
        {submitLabel}
      </Button>
      {allowRecovery ? (
        <button
          type="button"
          onClick={() => {
            setRecovery((r) => !r);
            setCode('');
          }}
          className="block w-full text-center text-sm font-semibold text-primary"
        >
          {recovery ? 'Usar o código do app' : 'Perdi o celular — usar código de recuperação'}
        </button>
      ) : null}
    </form>
  );
}
