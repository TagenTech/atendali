'use client';

import { formatBRL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, todayIn, zonedParts, type OrderSummaryDto } from '@skedulei/contracts';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Lock, Plus, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { CloseCashSheet, MovementSheet } from '@/components/finance/cash-sheets';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Ledger, LedgerTable, tdClass, thClass, theadClass } from '@/components/ui/ledger';
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
    <Link href={`/caixa/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60">
      <span className="w-12 shrink-0 font-display font-extrabold tabular text-muted-foreground">#{o.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{o.clientName ?? 'Sem cliente'}</span>
        <span className="block text-sm text-muted-foreground">
          {ORDER_STATUS_LABEL[o.status]} · {zonedParts(new Date(o.closedAt ?? o.openedAt), tz).time}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display font-extrabold tabular">{formatBRL(o.totalCents)}</span>
        {o.status === 'ABERTA' && o.paidCents ? (
          <span className="block text-xs text-muted-foreground">pago {formatBRL(o.paidCents)}</span>
        ) : null}
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}

function OrderLedger({ orders, tz, caption }: { orders: OrderSummaryDto[]; tz: string; caption: string }) {
  return (
    <Ledger>
      <div className="hidden overflow-x-auto lg:block">
        <LedgerTable caption={caption}>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Nº</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Situação</th>
              <th className={thClass}>Hora</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/40">
                <td className={`${tdClass} font-display font-extrabold tabular text-muted-foreground`}>
                  <Link href={`/caixa/${o.id}`} className="hover:underline">
                    #{o.number}
                  </Link>
                </td>
                <td className={`${tdClass} font-semibold`}>
                  <Link href={`/caixa/${o.id}`}>{o.clientName ?? 'Sem cliente'}</Link>
                </td>
                <td className={`${tdClass} text-sm text-muted-foreground`}>{ORDER_STATUS_LABEL[o.status]}</td>
                <td className={`${tdClass} tabular text-muted-foreground`}>
                  {zonedParts(new Date(o.closedAt ?? o.openedAt), tz).time}
                </td>
                <td className={`${tdClass} text-right font-display font-extrabold tabular`}>
                  {formatBRL(o.totalCents)}
                  {o.status === 'ABERTA' && o.paidCents ? (
                    <span className="ml-1 text-xs font-semibold text-muted-foreground">pago {formatBRL(o.paidCents)}</span>
                  ) : null}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link
                    href={`/caixa/${o.id}`}
                    aria-label={`Abrir comanda ${o.number}`}
                    className="inline-grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <ChevronRight className="size-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      </div>
      <div className="divide-y divide-border lg:hidden">
        {orders.map((o) => (
          <OrderRow key={o.id} o={o} tz={tz} />
        ))}
      </div>
    </Ledger>
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
  const openCount = open.data?.length ?? 0;

  const createOrder = async () => {
    try {
      const o = await newOrder.mutateAsync(undefined);
      router.push(`/caixa/${o.id}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-6 pb-8 pt-5 lg:space-y-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {cash
                ? `Aberto às ${zonedParts(new Date(cash.openedAt), tz).time} por ${cash.openedByName}`
                : 'Fechado'}
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Caixa</h1>
          </div>
          <Button size="sm" className="h-11 shrink-0 px-3.5 sm:px-4" loading={newOrder.isPending} onClick={createOrder}>
            <Plus /> Nova comanda
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-56 rounded-3xl" />
            ) : cash ? (
              <>
                <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up">
                  <p className="flex items-center gap-2 text-sm font-semibold text-success">
                    <Unlock className="size-4" aria-hidden />
                    Caixa aberto
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white/65">Esperado na gaveta</p>
                      <p className="mt-1 font-display text-2xl font-extrabold tabular leading-none sm:text-3xl">
                        {formatBRL(cash.expected.drawerCents)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white/65">Recebido hoje</p>
                      <p className="mt-1 font-display text-2xl font-extrabold tabular leading-none sm:text-3xl">
                        {formatBRL(dayTotal)}
                      </p>
                      <p className="mt-1.5 text-xs text-white/55">
                        {closedToday.data?.length ?? 0}{' '}
                        {(closedToday.data?.length ?? 0) === 1 ? 'comanda' : 'comandas'}
                      </p>
                    </div>
                  </div>
                </section>

                <KpiStrip cols={2}>
                  {(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'] as const).map((m) => (
                    <Kpi key={m} label={PAYMENT_METHOD_LABEL[m]} value={formatBRL(cash.expected.byMethod[m])} />
                  ))}
                </KpiStrip>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-11" onClick={() => setMoving('SANGRIA')}>
                    <ArrowUpFromLine /> Sangria
                  </Button>
                  <Button variant="outline" size="sm" className="h-11" onClick={() => setMoving('SUPRIMENTO')}>
                    <ArrowDownToLine /> Suprimento
                  </Button>
                </div>
                <Button variant="outline" className="h-11 w-full border-danger/30 text-danger hover:bg-danger-soft" onClick={() => setClosing(true)}>
                  <Lock /> Fechar caixa
                </Button>
              </>
            ) : (
              <>
                <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <Lock className="size-4" aria-hidden /> Caixa fechado
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Abra o caixa para receber pagamentos. Informe o troco que está na gaveta.
                  </p>
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
                </section>
                <div className="flex items-center justify-between rounded-3xl border border-border bg-card px-5 py-4">
                  <span>
                    <span className="block text-sm text-muted-foreground">Recebido hoje</span>
                    <span className="font-display text-2xl font-extrabold tabular">{formatBRL(dayTotal)}</span>
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {closedToday.data?.length ?? 0} comandas
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                <h2 className="font-display text-lg font-extrabold tracking-tight">
                  Comandas abertas
                  <span className="ml-1.5 text-muted-foreground">· {openCount}</span>
                </h2>
              </div>
              {open.data?.length ? (
                <OrderLedger orders={open.data} tz={tz} caption="Comandas abertas" />
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center">
                  <p className="font-display text-lg font-extrabold">Nenhuma comanda aberta</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Na agenda, abra a comanda pelo atendimento ou crie uma aqui.
                  </p>
                  <Button className="mt-5" size="sm" loading={newOrder.isPending} onClick={createOrder}>
                    <Plus /> Nova comanda
                  </Button>
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 px-1 font-display text-lg font-extrabold tracking-tight">Pagas hoje</h2>
              {closedToday.data?.length ? (
                <OrderLedger orders={closedToday.data} tz={tz} caption="Comandas pagas hoje" />
              ) : (
                <p
                  className={cn(
                    'rounded-3xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground',
                  )}
                >
                  Nada por enquanto.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
      {moving ? <MovementSheet kind={moving} onOpenChange={(v) => !v && setMoving(null)} /> : null}
      {closing && cash ? <CloseCashSheet cash={cash} onOpenChange={setClosing} /> : null}
    </>
  );
}
