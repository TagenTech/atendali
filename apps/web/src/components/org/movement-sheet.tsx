'use client';

import { STOCK_MOVEMENT_LABEL, type ManualMovement, type ProductDto } from '@agendei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useCreateMovement } from '@/lib/queries/retention';

const KINDS: ManualMovement[] = ['ENTRADA', 'SAIDA', 'AJUSTE'];
const HINT: Record<ManualMovement, string> = {
  ENTRADA: 'Compra ou reposição: atualiza o custo médio.',
  SAIDA: 'Perda, validade ou uso fora da comanda.',
  AJUSTE: 'Inventário: informe a quantidade contada.',
};

/** Entrada, saída ou inventário de um produto. */
export function MovementSheet({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: ProductDto }) {
  const move = useCreateMovement();
  const [kind, setKind] = React.useState<ManualMovement>('ENTRADA');
  const [quantity, setQuantity] = React.useState('');
  const [cost, setCost] = React.useState<number | null>(null);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = Number(quantity);
    if (quantity === '' || !Number.isInteger(q) || q < 0 || (kind !== 'AJUSTE' && q < 1)) return setError(kind === 'AJUSTE' ? 'Informe a quantidade contada' : 'Informe a quantidade');
    try {
      await move.mutateAsync({ productId: product.id, kind, quantity: q, unitCostCents: kind === 'ENTRADA' && cost !== null ? cost : undefined, note: note.trim() || null });
      toast.success('Estoque atualizado');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={product.name} description={`Em estoque: ${product.quantity} ${product.unit}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-semibold">Movimento</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => (setKind(k), setError(undefined))}>
                {STOCK_MOVEMENT_LABEL[k]}
              </Chip>
            ))}
          </div>
          <p className="pl-1 text-sm text-muted-foreground">{HINT[kind]}</p>
        </fieldset>
        <Field label={kind === 'AJUSTE' ? 'Quantidade contada' : 'Quantidade'} htmlFor="mov-qty" error={error}>
          <Input id="mov-qty" type="number" inputMode="numeric" min={0} step={1} value={quantity} invalid={!!error} autoFocus onChange={(e) => (setQuantity(e.target.value), setError(undefined))} trailing={<span className="text-sm text-muted-foreground">{product.unit}</span>} />
        </Field>
        {kind === 'ENTRADA' ? (
          <Field label="Custo por unidade" htmlFor="mov-cost" hint="Opcional; usado no custo médio">
            <MoneyInput id="mov-cost" value={cost} onChange={setCost} />
          </Field>
        ) : null}
        <Field label="Observação (opcional)" htmlFor="mov-note">
          <Input id="mov-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" block loading={move.isPending}>
          Lançar
        </Button>
      </form>
    </Sheet>
  );
}
