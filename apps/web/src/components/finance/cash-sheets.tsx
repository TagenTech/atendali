'use client';

import { formatBRL, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, type CashMovementKind, type CashSessionDto } from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import * as fin from '@/lib/api/finance';
import { useFieldErrors } from '@/lib/use-field-errors';
import { errorText } from '@/lib/api/client';
import { useFinanceMutation } from '@/lib/queries/finance';
import { cn } from '@/lib/utils';

/** Sangria (tirar da gaveta) ou suprimento (pôr troco). */
export function MovementSheet({ kind, onOpenChange }: { kind: CashMovementKind; onOpenChange: (v: boolean) => void }) {
  const move = useFinanceMutation((orgId, body: Parameters<typeof fin.cashMovement>[1]) => fin.cashMovement(orgId, body));
  const [amount, setAmount] = React.useState<number | null>(null);
  const [note, setNote] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();
  const sangria = kind === 'SANGRIA';
  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={sangria ? 'Sangria' : 'Suprimento'}
      description={sangria ? 'Dinheiro que sai da gaveta (depósito, pagamento).' : 'Dinheiro que entra na gaveta (troco).'}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'mv-amount': !amount && 'Informe um valor maior que zero' })) return;
          if (!amount) return;
          try {
            await move.mutateAsync({ kind, amountCents: amount, note: note.trim() || null });
            toast.success(sangria ? 'Sangria registrada' : 'Suprimento registrado');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <Field label="Valor" htmlFor="mv-amount" error={errors['mv-amount']}>
          <MoneyInput id="mv-amount" value={amount} invalid={!!errors['mv-amount']} onChange={(v) => (setAmount(v), clear('mv-amount'))} autoFocus />
        </Field>
        <Field label="Motivo (opcional)" htmlFor="mv-note">
          <Input id="mv-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" block loading={move.isPending}>
          Registrar
        </Button>
      </form>
    </Sheet>
  );
}

/** Fechamento: confere o que entrou em cada forma e conta o dinheiro da gaveta. */
export function CloseCashSheet({ cash, onOpenChange }: { cash: CashSessionDto; onOpenChange: (v: boolean) => void }) {
  const close = useFinanceMutation((orgId, body: Parameters<typeof fin.closeCash>[1]) => fin.closeCash(orgId, body));
  const [counted, setCounted] = React.useState<number | null>(null);
  const { errors, fail, clear } = useFieldErrors();
  const [notes, setNotes] = React.useState('');
  const diff = counted === null ? null : counted - cash.expected.drawerCents;
  const moves = cash.movements.reduce((s, m) => s + (m.kind === 'SUPRIMENTO' ? m.amountCents : -m.amountCents), 0);

  return (
    <Sheet open onOpenChange={onOpenChange} title="Fechar caixa" description="Confira os valores e conte o dinheiro da gaveta.">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'cc-counted': counted === null && 'Informe o dinheiro contado (pode ser 0)' })) return;
          if (counted === null) return;
          try {
            await close.mutateAsync({ countedCents: counted, notes: notes.trim() || null });
            toast.success('Caixa fechado ✓');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Recebido por forma de pagamento</caption>
          <tbody className="divide-y divide-border">
            {PAYMENT_METHODS.filter((m) => cash.expected.byMethod[m]).map((m) => (
              <tr key={m}>
                <th scope="row" className="py-2 text-left font-medium">
                  {PAYMENT_METHOD_LABEL[m]}
                </th>
                <td className="py-2 text-right font-semibold tabular">{formatBRL(cash.expected.byMethod[m])}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 text-left font-medium text-muted-foreground">
                Troco inicial
              </th>
              <td className="py-2 text-right tabular text-muted-foreground">{formatBRL(cash.openingCents)}</td>
            </tr>
            {moves ? (
              <tr>
                <th scope="row" className="py-2 text-left font-medium text-muted-foreground">
                  Sangrias e suprimentos
                </th>
                <td className="py-2 text-right tabular text-muted-foreground">{formatBRL(moves)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row" className="py-2 text-left font-bold">
                Esperado na gaveta
              </th>
              <td className="py-2 text-right font-display text-lg font-black tabular">{formatBRL(cash.expected.drawerCents)}</td>
            </tr>
          </tbody>
        </table>
        <Field label="Dinheiro contado na gaveta" htmlFor="cc-counted" error={errors['cc-counted']}>
          <MoneyInput id="cc-counted" value={counted} invalid={!!errors['cc-counted']} onChange={(v) => (setCounted(v ?? 0), clear('cc-counted'))} />
        </Field>
        {diff !== null ? (
          <p
            role="status"
            className={cn(
              'rounded-2xl px-4 py-3 text-sm font-semibold',
              diff === 0 ? 'bg-success-soft text-success-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground',
            )}
          >
            {diff === 0 ? 'Bateu certinho ✓' : diff > 0 ? `Sobrando ${formatBRL(diff)}` : `Faltando ${formatBRL(-diff)}`}
          </p>
        ) : null}
        <Field label="Observação (opcional)" htmlFor="cc-notes">
          <Input id="cc-notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" block size="lg" loading={close.isPending}>
          Fechar caixa
        </Button>
      </form>
    </Sheet>
  );
}
