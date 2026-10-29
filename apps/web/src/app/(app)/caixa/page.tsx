'use client';

import { formatBRL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, todayIn, zonedParts, type OrderSummaryDto } from '@skedulei/contracts';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Lock, Plus, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { CloseCashSheet, MovementSheet } from '@/components/finance/cash-sheets';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Ledger, LedgerTable, tdClass, thClass, theadClass } from '@/components/ui/ledger';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import * as fin from '@/lib/api/finance';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCash, useFinanceMutation, useOrders } from '@/lib/queries/finance';
import { useHydrated } from '@/lib/use-hydrated';

function OrderRow({ o, tz }: { o: OrderSummaryDto; tz: string }) {
  return (
    <Link href={`/caixa/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
      <span className="w-12 shrink-0 font-display font-extrabold tabular text-muted-foreground">#{o.number}</span>
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
                <td className={`${tdClass} tabular text-muted-foreground`}>{zonedParts(new Date(o.closedAt ?? o.openedAt), tz).time}</td>
                <td className={`${tdClass} text-right font-display font-extrabold tabular`}>
                  {formatBRL(o.totalCents)}
                  {o.status === 'ABERTA' && o.paidCents ? <span className="ml-1 text-xs font-semibold text-muted-foreground">pago {formatBRL(o.paidCents)}</span> : null}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/caixa/${o.id}`} aria-label={`Abrir comanda ${o.number}`} className="inline-grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
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
            <div className="space-y-4">
              <p className="flex items-center gap-2 px-1 text-sm font-bold text-success">
                <Unlock className="size-4" /> Caixa aberto
              </p>
              <KpiStrip cols={2}>
                <Kpi label="Esperado na gaveta" value={formatBRL(cash.expected.drawerCents)} />
                <Kpi label="Recebido hoje" value={formatBRL(dayTotal)} hint={`${closedToday.data?.length ?? 0} comandas`} />
              </KpiStrip>
              <KpiStrip cols={2}>
                {(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'] as const).map((m) => (
                  <Kpi key={m} label={PAYMENT_METHOD_LABEL[m]} value={formatBRL(cash.expected.byMethod[m])} />
                ))}
              </KpiStrip>
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
            </div>
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
          {!cash ? (
            <Ledger className="flex items-center justify-between px-5 py-4">
              <span>
                <span className="block text-sm text-muted-foreground">Recebido hoje</span>
                <span className="font-display text-2xl font-extrabold tabular">{formatBRL(dayTotal)}</span>
              </span>
              <span className="text-right text-sm text-muted-foreground">{closedToday.data?.length ?? 0} comandas</span>
            </Ledger>
          ) : null}
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">Comandas abertas · {open.data?.length ?? 0}</h2>
            {open.data?.length ? (
              <OrderLedger orders={open.data} tz={tz} caption="Comandas abertas" />
            ) : (
              <EmptyState inline title="Nenhuma comanda aberta" description='Na agenda, abra a comanda pelo atendimento ("Abrir comanda") ou crie uma aqui.' />
            )}
          </section>
          <section>
            <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">Pagas hoje</h2>
            {closedToday.data?.length ? (
              <OrderLedger orders={closedToday.data} tz={tz} caption="Comandas pagas hoje" />
            ) : (
              <p className="rounded-3xl border border-border bg-card p-4 text-center text-muted-foreground">Nada por enquanto.</p>
            )}
          </section>
        </div>
      </div>
      {moving ? <MovementSheet kind={moving} onOpenChange={(v) => !v && setMoving(null)} /> : null}
      {closing && cash ? <CloseCashSheet cash={cash} onOpenChange={setClosing} /> : null}
    </>
  );
}
