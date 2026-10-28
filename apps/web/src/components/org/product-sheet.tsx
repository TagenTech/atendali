'use client';

import { PRODUCT_KIND_LABEL, ProductKind, type ProductDto } from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useSaveProduct } from '@/lib/queries/retention';

/** Criar (product = null) ou editar um produto/insumo. O tipo não muda depois de criado. */
export function ProductSheet({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: ProductDto | null }) {
  const save = useSaveProduct();
  const [name, setName] = React.useState(product?.name ?? '');
  const [kind, setKind] = React.useState<ProductKind>(product?.kind ?? ProductKind.VENDA);
  const [unit, setUnit] = React.useState(product?.unit ?? 'un');
  const [price, setPrice] = React.useState<number | null>(product?.salePriceCents ?? null);
  const [min, setMin] = React.useState(String(product?.minQuantity ?? 0));
  const [nameError, setNameError] = React.useState<string>();
  const [priceError, setPriceError] = React.useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError('Dê um nome ao produto');
    if (kind === ProductKind.VENDA && price === null) return setPriceError('Informe o preço de venda');
    const common = { name: name.trim(), unit: unit.trim() || 'un', minQuantity: Math.max(0, Number(min) || 0) };
    try {
      await save.mutateAsync({
        id: product?.id,
        body: product ? { ...common, salePriceCents: kind === ProductKind.VENDA ? price : undefined } : { ...common, kind, salePriceCents: kind === ProductKind.VENDA ? price : null },
      });
      toast.success(product ? 'Alterações salvas' : 'Produto cadastrado ✨');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggleActive = async () => {
    if (!product) return;
    try {
      await save.mutateAsync({ id: product.id, body: { active: !product.active } });
      toast.success(product.active ? 'Produto desativado' : 'Produto reativado');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={product ? 'Editar produto' : 'Novo produto'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {product ? null : (
          <fieldset className="space-y-2">
            <legend className="pl-1 text-sm font-semibold">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {Object.values(ProductKind).map((k) => (
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {PRODUCT_KIND_LABEL[k]}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="Nome" htmlFor="prd-name" error={nameError}>
          <Input id="prd-name" value={name} invalid={!!nameError} maxLength={120} autoFocus={!product} onChange={(e) => (setName(e.target.value), setNameError(undefined))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidade" htmlFor="prd-unit" hint="un, ml, g…">
            <Input id="prd-unit" value={unit} maxLength={8} onChange={(e) => setUnit(e.target.value)} />
          </Field>
          <Field label="Estoque mínimo" htmlFor="prd-min" hint="Avisa quando ficar abaixo">
            <Input id="prd-min" type="number" inputMode="numeric" min={0} value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
        </div>
        {kind === ProductKind.VENDA ? (
          <Field label="Preço de venda" htmlFor="prd-price" error={priceError}>
            <MoneyInput id="prd-price" value={price} onChange={(v) => (setPrice(v), setPriceError(undefined))} />
          </Field>
        ) : null}
        <div className="flex gap-3 pt-2">
          {product ? (
            <Button type="button" variant={product.active ? 'danger' : 'soft'} onClick={toggleActive} disabled={save.isPending}>
              {product.active ? 'Desativar' : 'Reativar'}
            </Button>
          ) : null}
          <Button type="submit" block loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
