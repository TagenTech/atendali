'use client';

import { ProductKind } from '@skedulei/contracts';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorText } from '@/lib/api/client';
import { useProducts, useServiceSupplies, useSetSupplies } from '@/lib/queries/retention';

interface Row {
  productId: string;
  quantity: string;
}

/** Ficha técnica: quanto de cada insumo um atendimento consome (baixa no fechamento da comanda). */
export function SuppliesEditor({ serviceId }: { serviceId: string }) {
  const supplies = useServiceSupplies(serviceId);
  const products = (useProducts().data ?? []).filter((p) => p.kind === ProductKind.INSUMO && p.active);
  const save = useSetSupplies();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const current = rows ?? (supplies.data ?? []).map((s) => ({ productId: s.productId, quantity: String(s.quantity) }));
  const dirty = rows !== null;

  const patch = (i: number, p: Partial<Row>) => setRows(current.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const used = new Set(current.map((r) => r.productId));

  const submit = async () => {
    const supplies = current.filter((r) => r.productId).map((r) => ({ productId: r.productId, quantity: Math.trunc(Number(r.quantity)) }));
    if (supplies.some((s) => !(s.quantity >= 1))) return toast.error('Informe a quantidade de cada insumo');
    try {
      await save.mutateAsync({ serviceId, supplies });
      setRows(null);
      toast.success('Ficha técnica salva');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <fieldset className="space-y-2 rounded-2xl border-2 border-dashed border-border p-3">
      <legend className="px-1 text-sm font-semibold">Ficha técnica (insumos por atendimento)</legend>
      {!products.length && !current.length ? (
        <p className="text-sm text-muted-foreground">Cadastre insumos em Estoque para montar a ficha.</p>
      ) : (
        <>
          {current.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                aria-label="Insumo"
                value={r.productId}
                onChange={(e) => patch(i, { productId: e.target.value })}
                className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-2 outline-none focus:border-primary"
              >
                <option value="">Escolha…</option>
                {products
                  .filter((p) => p.id === r.productId || !used.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
              </select>
              <Input aria-label="Quantidade" type="number" inputMode="numeric" min={1} value={r.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} className="h-11 w-24 rounded-xl px-3" />
              <button type="button" aria-label="Remover insumo" onClick={() => setRows(current.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={used.size >= products.length} onClick={() => setRows([...current, { productId: '', quantity: '1' }])}>
              <Plus /> Adicionar insumo
            </Button>
            {dirty ? (
              <Button type="button" size="sm" variant="soft" loading={save.isPending} onClick={submit}>
                Salvar ficha
              </Button>
            ) : null}
          </div>
        </>
      )}
    </fieldset>
  );
}
