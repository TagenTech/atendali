'use client';

import {
  changeFor,
  Feature,
  formatBRL,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  paymentFee,
  type PaymentMethod,
} from '@skedulei/contracts';
import { CheckCircle2, Lock, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ClientPicker, type PickedClient } from '@/components/agenda/client-picker';
import { LoyaltyRedeem, ReviewRequest } from '@/components/finance/order-extras';
import { OrderItemForm } from '@/components/finance/order-item-form';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import * as fin from '@/lib/api/finance';
import { useFieldErrors } from '@/lib/use-field-errors';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCash, useFinanceMutation, useOrder } from '@/lib/queries/finance';
import * as ret from '@/lib/api/retention';
import { cn } from '@/lib/utils';

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', muted && 'text-muted-foreground', strong && 'font-display text-xl font-black')}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

export default function ComandaPage() {
  const { id } = useParams<{ id: string }>();
  const back = useBack('/caixa');
  const { org, vocab, has } = useOrg();
  const { data: o, isError } = useOrder(id);
  const { data: cashSession, isLoading: cashLoading } = useCash();
  const methods = org.paymentMethods.filter((m) => m.enabled);
  // Vale-presente não é configurável (sem taxa): aparece quando o módulo está ligado.
  const payMethods = [
    ...methods.map((m) => m.method),
    ...(has(Feature.VALES) ? (['VALE_PRESENTE'] as const) : []),
  ];

  const run = useFinanceMutation((orgId, f: (orgId: string) => Promise<unknown>) => f(orgId));
  const act = async (f: (orgId: string) => Promise<unknown>, ok?: string) => {
    try {
      await run.mutateAsync(f);
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      toast.error(errorText(err));
      return false;
    }
  };

  // Pagamento
  const [method, setMethod] = React.useState<PaymentMethod>(methods[0]?.method ?? 'PIX');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [received, setReceived] = React.useState<number | null>(null);
  const [giftCode, setGiftCode] = React.useState('');
  const { errors: payErrors, fail: failPay, clear: clearPay } = useFieldErrors();
  const [discount, setDiscount] = React.useState<number | null>(null);
  const [editingClient, setEditingClient] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  if (isError) return <EmptyState emoji="🧾" title="Comanda não encontrada" description="Confira o link." />;
  if (!o) return <Skeleton className="m-5 h-96 rounded-3xl" />;

  const open = o.status === 'ABERTA';
  const due = o.totals.dueCents;
  const payValue = amount ?? due;
  const cfg = methods.find((m) => m.method === method);
  const cash = method === 'DINHEIRO';
  const gift = method === 'VALE_PRESENTE';
  const change = cash && received !== null ? changeFor(received, due) : 0;

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = cash ? Math.min(received ?? due, due) : payValue;
    const valueId = cash ? 'pay-received' : 'pay-amount';
    if (!failPay({ [valueId]: !value && 'Informe um valor maior que zero', 'pay-gift': gift && !giftCode.trim() && 'Informe o código do vale' }) || !value) return;
    const body = { method, amountCents: value, ...(gift ? { giftCode: giftCode.trim() } : {}) };
    if (await act((orgId) => fin.addOrderPayment(orgId, o.id, body), change ? `Troco: ${formatBRL(change)}` : 'Pagamento registrado')) {
      setAmount(null);
      setReceived(null);
      setGiftCode('');
    }
  };

  return (
    <>
      <FormTopBar onBack={back} title={`Comanda #${o.number}`}>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-bold',
            o.status === 'ABERTA' ? 'bg-warning-soft text-warning-soft-foreground' : o.status === 'FECHADA' ? 'bg-success-soft text-success-soft-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {ORDER_STATUS_LABEL[o.status]}
        </span>
      </FormTopBar>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 pb-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {/* Cliente */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span>
                <span className="block text-sm text-muted-foreground">{vocab.client}</span>
                {o.clientId ? (
                  <Link href={`/clientes/${o.clientId}`} className="font-display text-lg font-extrabold hover:underline">
                    {o.clientName}
                  </Link>
                ) : (
                  <span className="font-display text-lg font-extrabold text-muted-foreground">Sem cliente</span>
                )}
              </span>
              {open ? (
                <Button size="sm" variant="ghost" onClick={() => setEditingClient((v) => !v)}>
                  {editingClient ? 'Fechar' : o.clientId ? 'Trocar' : 'Escolher'}
                </Button>
              ) : null}
            </div>
            {editingClient ? (
              <ClientPicker
                value={null}
                onChange={async (v: PickedClient) => {
                  if (!v?.client) return;
                  if (await act((orgId) => fin.updateOrder(orgId, o.id, { clientId: v.client!.id }), 'Cliente definido')) setEditingClient(false);
                }}
              />
            ) : null}
          </Card>

          {/* Itens */}
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Itens</h2>
            <Card className="divide-y divide-border p-0">
              {o.items.length ? (
                o.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {i.quantity > 1 ? `${i.quantity}× ` : ''}
                        {i.description}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">{i.memberName ?? 'Sem profissional'}</span>
                    </span>
                    <span className="text-right tabular">
                      <span className="block font-semibold">{formatBRL(i.netCents)}</span>
                      {i.netCents !== i.quantity * i.unitPriceCents ? (
                        <span className="block text-xs text-muted-foreground line-through">{formatBRL(i.quantity * i.unitPriceCents)}</span>
                      ) : null}
                    </span>
                    {open ? (
                      <button
                        type="button"
                        aria-label={`Remover ${i.description}`}
                        onClick={() => act((orgId) => fin.removeOrderItem(orgId, o.id, i.id), 'Item removido')}
                        className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-muted-foreground">Comanda vazia — adicione um item.</p>
              )}
            </Card>
          </section>

          {open ? <OrderItemForm order={o} pending={run.isPending} onAdd={(body) => act((orgId) => fin.addOrderItem(orgId, o.id, body), 'Item adicionado')} /> : null}
        </div>

        {/* Totais e pagamento */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="space-y-2">
            <Row label="Subtotal" value={formatBRL(o.totals.subtotalCents)} muted />
            {o.totals.discountCents ? <Row label="Descontos" value={`− ${formatBRL(o.totals.discountCents)}`} muted /> : null}
            <Row label="Total" value={formatBRL(o.totals.totalCents)} strong />
            <Row label="Pago" value={formatBRL(o.totals.paidCents)} />
            {open ? <Row label="Falta" value={formatBRL(due)} strong /> : null}
            {open ? (
              <form
                className="flex items-end gap-2 pt-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await act((orgId) => fin.updateOrder(orgId, o.id, { discountCents: discount ?? 0 }), 'Desconto aplicado')) setDiscount(null);
                }}
              >
                <Field label="Desconto na comanda" htmlFor="od-discount" className="flex-1">
                  <MoneyInput id="od-discount" value={discount ?? o.discountCents} onChange={(v) => setDiscount(v ?? 0)} />
                </Field>
                <Button type="submit" variant="outline" disabled={discount === null}>
                  Aplicar
                </Button>
              </form>
            ) : null}
          </Card>

          {open ? <LoyaltyRedeem order={o} busy={run.isPending} onRedeem={(points) => act((orgId) => ret.redeemPoints(orgId, o.id, points), points ? 'Pontos aplicados' : 'Resgate desfeito')} /> : null}
          <ReviewRequest order={o} />

          {o.payments.length ? (
            <Card className="space-y-2">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pagamentos</p>
              {o.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {PAYMENT_METHOD_LABEL[p.method]}
                    {p.feeCents ? <span className="text-muted-foreground"> · taxa {formatBRL(p.feeCents)}</span> : null}
                  </span>
                  <span className="font-semibold tabular">{formatBRL(p.amountCents)}</span>
                  {open ? (
                    <button
                      type="button"
                      aria-label={`Remover pagamento ${PAYMENT_METHOD_LABEL[p.method]}`}
                      onClick={() => act((orgId) => fin.removeOrderPayment(orgId, o.id, p.id), 'Pagamento removido')}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : null}

          {open && due > 0 && o.items.length && !cashLoading && !cashSession ? (
            <Card className="space-y-3 bg-warning-soft">
              <p className="flex items-center gap-2 font-semibold text-warning-soft-foreground">
                <Lock className="size-4" /> O caixa está fechado
              </p>
              <p className="text-sm text-warning-soft-foreground">Abra o caixa para receber os pagamentos desta comanda.</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/caixa">Abrir caixa</Link>
              </Button>
            </Card>
          ) : null}

          {open && due > 0 && o.items.length && cashSession ? (
            <Card>
              <form onSubmit={pay} className="space-y-3" noValidate>
                <p className="font-display text-lg font-extrabold">Receber</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pagamento">
                  {payMethods.map((m) => (
                    <Chip key={m} active={method === m} onClick={() => setMethod(m)} role="radio" aria-checked={method === m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </Chip>
                  ))}
                </div>
                {gift ? (
                  <Field label="Código do vale" htmlFor="pay-gift" hint="Ex.: ABCD-EFGH-JKLM" error={payErrors['pay-gift']}>
                    <Input id="pay-gift" value={giftCode} maxLength={20} autoComplete="off" invalid={!!payErrors['pay-gift']} onChange={(e) => (setGiftCode(e.target.value.toUpperCase()), clearPay('pay-gift'))} className="font-mono tracking-wider" />
                  </Field>
                ) : null}
                {cash ? (
                  <Field label="Recebido em dinheiro" htmlFor="pay-received" hint={change ? `Troco: ${formatBRL(change)}` : `Falta ${formatBRL(due)}`} error={payErrors['pay-received']}>
                    <MoneyInput id="pay-received" value={received ?? due} invalid={!!payErrors['pay-received']} onChange={(v) => (setReceived(v ?? 0), clearPay('pay-received'))} />
                  </Field>
                ) : (
                  <Field
                    label="Valor"
                    htmlFor="pay-amount"
                    hint={cfg && cfg.feeBps + cfg.feeFixedCents > 0 ? `Taxa estimada: ${formatBRL(paymentFee(payValue, cfg))}` : undefined}
                    error={payErrors['pay-amount']}
                  >
                    <MoneyInput id="pay-amount" value={payValue} invalid={!!payErrors['pay-amount']} onChange={(v) => (setAmount(v ?? 0), clearPay('pay-amount'))} />
                  </Field>
                )}
                <Button type="submit" block loading={run.isPending}>
                  Registrar pagamento
                </Button>
              </form>
            </Card>
          ) : null}

          {open ? (
            <Button
              block
              size="lg"
              disabled={due > 0 || !o.items.length}
              loading={run.isPending}
              onClick={() => act((orgId) => fin.closeOrder(orgId, o.id), 'Comanda paga ✓')}
            >
              <CheckCircle2 /> Fechar comanda
            </Button>
          ) : null}
          {o.status !== 'CANCELADA' ? (
            <Button
              block
              variant="danger"
              onClick={async () => {
                if (!confirmCancel) return setConfirmCancel(true);
                await act((orgId) => fin.cancelOrder(orgId, o.id), open ? 'Comanda cancelada' : 'Comanda estornada');
                setConfirmCancel(false);
              }}
            >
              <Undo2 /> {confirmCancel ? 'Confirmar' : open ? 'Cancelar comanda' : 'Estornar'}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
