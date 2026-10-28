'use client';

import { formatBRL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, todayIn, zonedParts, type OrderSummaryDto } from '@agendei/contracts';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Lock, Plus, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { CloseCashSheet, MovementSheet } from '@/components/finance/cash-sheets';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import * as fin from '@/lib/api/finance';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCash, useFinanceMutation, useOrders } from '@/lib/queries/finance';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/utils';

function OrderRow({ o, tz }: { o: OrderSummaryDto; tz: string }) {
  return (
    <Link href={`/caixa/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
      <span className="w-12 shrink-0 font-display font-black tabular text-muted-foreground">#{o.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{o.clientName ?? 'Sem cliente'}</span>
        <span className="block text-sm text-muted-foreground">
          {ORDER_STATUS_LABEL[o.status]} · {zonedParts(new Date(o.closedAt ?? o.openedAt), tz).time}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display font-extrabold tabular">{formatBRL(o.totalCents)}</span>
        {o.status === 'ABERTA' && o.paidCents ? <span className="block text-xs text-muted-foreground">pago {formatBRL(o.paidCents)}</span> : null}
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}

export default function CaixaPage() {
  const { org } = useOrg();
  const router = useRouter();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn(org.timezone) : undefined;
  const { data: cash, isLoading } = useCash();
  const open = useOrders({ status: 'ABERTA' });
  const closedToday = useOrders({ status: 'FECHADA', date: today });
  const openCash = useFinanceMutation((orgId, openingCents: number) => fin.openCash(orgId, { openingCents }));
  const newOrder = useFinanceMutation((orgId) => fin.createOrder(orgId, {}));
  const [opening, setOpening] = React.useState<number | null>(null);
  const [moving, setMoving] = React.useState<'SANGRIA' | 'SUPRIMENTO' | null>(null);
  const [closing, setClosing] = React.useState(false);
  const tz = org.timezone;
  const dayTotal = (closedToday.data ?? []).reduce((s, o) => s + o.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Caixa"
        subtitle={cash ? `Aberto às ${zonedParts(new Date(cash.openedAt), tz).time} por ${cash.openedByName}` : 'Fechado'}
        action={
          <Button
            size="sm"
            className="lg:h-11 lg:px-4"
            loading={newOrder.isPending}
            onClick={async () => {
              try {
                const o = await newOrder.mutateAsync(undefined);
                router.push(`/caixa/${o.id}`);
              } catch (err) {
                toast.error(errorText(err));
              }
            }}
          >
            <Plus /> Nova comanda
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-48 rounded-3xl" />
          ) : cash ? (
            <Card className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-success">
                <Unlock className="size-4" /> Caixa aberto
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Esperado na gaveta</p>
                <p className="font-display text-3xl font-black tabular">{formatBRL(cash.expected.drawerCents)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'] as const).map((m) => (
                  <div key={m} className="rounded-xl bg-muted px-3 py-2">
                    <dt className="text-muted-foreground">{PAYMENT_METHOD_LABEL[m]}</dt>
                    <dd className="font-semibold tabular">{formatBRL(cash.expected.byMethod[m])}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setMoving('SANGRIA')}>
                  <ArrowUpFromLine /> Sangria
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMoving('SUPRIMENTO')}>
                  <ArrowDownToLine /> Suprimento
                </Button>
              </div>
              <Button variant="danger" block onClick={() => setClosing(true)}>
                <Lock /> Fechar caixa
              </Button>
            </Card>
          ) : (
            <Card className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <Lock className="size-4" /> Caixa fechado
              </div>
              <p className="text-sm text-muted-foreground">Abra o caixa para receber pagamentos. Informe o troco que está na gaveta.</p>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await openCash.mutateAsync(opening ?? 0);
                    toast.success('Caixa aberto ✓');
                  } catch (err) {
                    toast.error(errorText(err));
                  }
                }}
              >
                <Field label="Troco inicial" htmlFor="cx-opening">
                  <MoneyInput id="cx-opening" value={opening} onChange={setOpening} />
                </Field>
                <Button type="submit" block loading={openCash.isPending}>
                  <Unlock /> Abrir caixa
                </Button>
              </form>
            </Card>
          )}
          <Card className="flex items-center justify-between">
            <span>
              <span className="block text-sm text-muted-foreground">Recebido hoje</span>
              <span className="font-display text-2xl font-black tabular">{formatBRL(dayTotal)}</span>
            </span>
            <span className="text-right text-sm text-muted-foreground">{closedToday.data?.length ?? 0} comandas</span>
          </Card>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Comandas abertas · {open.data?.length ?? 0}</h2>
            {open.data?.length ? (
              <Card className="divide-y divide-border p-0">
                {open.data.map((o) => (
                  <OrderRow key={o.id} o={o} tz={tz} />
                ))}
              </Card>
            ) : (
              <EmptyState emoji="🧾" title="Nenhuma comanda aberta" description='Na agenda, abra a comanda pelo atendimento ("Abrir comanda") ou crie uma aqui.' className="py-6" />
            )}
          </section>
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Pagas hoje</h2>
            <Card className={cn('divide-y divide-border p-0', !closedToday.data?.length && 'p-4 text-center text-muted-foreground')}>
              {closedToday.data?.length ? closedToday.data.map((o) => <OrderRow key={o.id} o={o} tz={tz} />) : 'Nada por enquanto.'}
            </Card>
          </section>
        </div>
      </div>
      {moving ? <MovementSheet kind={moving} onOpenChange={(v) => !v && setMoving(null)} /> : null}
      {closing && cash ? <CloseCashSheet cash={cash} onOpenChange={setClosing} /> : null}
    </>
  );
}
