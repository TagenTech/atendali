'use client';

import { formatBRL, PAYMENT_METHOD_LABEL } from '@skedulei/contracts';
import { DailyColumns, HBars } from '@/components/finance/charts';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { PeriodPicker, usePeriod } from '@/components/finance/period';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useFinanceSummary } from '@/lib/queries/finance';

export default function FinanceiroPage() {
  const { vocab } = useOrg();
  const period = usePeriod('mes');
  const range = period.range;
  const { data: s, isLoading } = useFinanceSummary(range?.from ?? null, range?.to ?? null);

  return (
    <div className="mx-auto w-full max-w-7xl pb-8 pt-5 lg:pb-10 lg:pt-8">
      <header className="px-6 lg:px-8">
        <p className="text-sm font-medium text-muted-foreground">Comandas pagas no período</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Financeiro</h1>
      </header>

      <div className="mt-4">
        <FinanceTabs />
      </div>

      <div className="mt-4 space-y-5 px-6 lg:space-y-6 lg:px-8">
        <PeriodPicker period={period} />

        {isLoading || !s ? (
          <Skeleton className="h-80 rounded-3xl" />
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up sm:px-6 sm:py-6">
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-end sm:gap-8">
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Faturamento</p>
                  <p className="mt-1 font-display text-3xl font-extrabold tabular leading-none sm:text-4xl">
                    {formatBRL(s.revenueCents)}
                  </p>
                  {s.discountsCents ? (
                    <p className="mt-2 text-sm text-white/55">{formatBRL(s.discountsCents)} em descontos</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
                  <div className="min-w-0">
                    <p className="text-sm text-white/65">Líquido</p>
                    <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">
                      {formatBRL(s.netCents)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white/65">Comandas</p>
                    <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{s.orders}</p>
                    <p className="mt-1.5 text-xs text-white/55">ticket {formatBRL(s.averageTicketCents)}</p>
                  </div>
                </div>
              </div>
            </section>

            <KpiStrip cols={2}>
              <Kpi label="Taxas de pagamento" value={formatBRL(s.feesCents)} />
              <Kpi label="Comissões" value={formatBRL(s.commissionsCents)} />
            </KpiStrip>

            {!s.orders ? (
              <EmptyState
                title="Sem vendas no período"
                description="Os números aparecem quando as comandas são pagas no Caixa."
              />
            ) : (
              <>
                {s.byDay.length > 1 ? (
                  <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                    <h2 className="mb-4 font-display text-lg font-extrabold tracking-tight">Faturamento por dia</h2>
                    <DailyColumns data={s.byDay} label="Faturamento por dia" />
                  </section>
                ) : null}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                  <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                    <h2 className="mb-4 font-display text-lg font-extrabold tracking-tight">Por forma de pagamento</h2>
                    <HBars
                      rows={s.byMethod.map((m) => ({
                        label: PAYMENT_METHOD_LABEL[m.method],
                        valueCents: m.amountCents,
                        hint: m.feesCents ? `taxa ${formatBRL(m.feesCents)}` : undefined,
                      }))}
                    />
                  </section>
                  <section className="overflow-x-auto rounded-3xl border border-border bg-card p-5 sm:p-6">
                    <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Por profissional</h2>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs font-semibold text-muted-foreground">
                        <tr>
                          <th className="py-2 font-bold">Profissional</th>
                          <th className="whitespace-nowrap py-2 pl-3 text-right font-bold">Itens</th>
                          <th className="whitespace-nowrap py-2 pl-3 text-right font-bold">Faturou</th>
                          <th className="whitespace-nowrap py-2 pl-3 text-right font-bold">Comissão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {s.byProfessional.map((p) => (
                          <tr key={p.memberId}>
                            <td className="py-2.5 font-semibold">{p.name}</td>
                            <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular">{p.items}</td>
                            <td className="whitespace-nowrap py-2.5 pl-3 text-right font-display font-extrabold tabular">
                              {formatBRL(p.revenueCents)}
                            </td>
                            <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular text-muted-foreground">
                              {formatBRL(p.commissionsCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </div>

                <section className="overflow-x-auto rounded-3xl border border-border bg-card p-5 sm:p-6">
                  <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Mais vendidos</h2>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs font-semibold text-muted-foreground">
                      <tr>
                        <th className="py-2 font-bold">{vocab.service} / item</th>
                        <th className="whitespace-nowrap py-2 pl-3 text-right font-bold">Qtd.</th>
                        <th className="whitespace-nowrap py-2 pl-3 text-right font-bold">Faturou</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {s.byService.map((x) => (
                        <tr key={x.name}>
                          <td className="py-2.5 font-semibold">{x.name}</td>
                          <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular">{x.quantity}</td>
                          <td className="whitespace-nowrap py-2.5 pl-3 text-right font-display font-extrabold tabular">
                            {formatBRL(x.revenueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
