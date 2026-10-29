'use client';

import { formatBRL, formatDateShort, pct } from '@skedulei/contracts';
import { HBars } from '@/components/finance/charts';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { PeriodPicker, usePeriod } from '@/components/finance/period';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDre } from '@/lib/queries/ledger';

interface Line {
  label: string;
  cents: number;
  /** Sinal mostrado antes do valor: dedução (−) ou nada. */
  minus?: boolean;
  strong?: boolean;
  hint?: string;
}

export default function DrePage() {
  const period = usePeriod('mes');
  const { range } = period;
  const { data: d, isLoading } = useDre(range?.from ?? null, range?.to ?? null);

  const lines: Line[] = d
    ? [
        { label: 'Receita bruta', cents: d.grossRevenueCents, strong: true, hint: d.otherRevenueCents ? `inclui ${formatBRL(d.otherRevenueCents)} de outras receitas` : undefined },
        { label: 'Descontos', cents: d.discountsCents, minus: true },
        { label: 'Taxas de pagamento', cents: d.feesCents, minus: true },
        { label: 'Receita líquida', cents: d.netRevenueCents, strong: true },
        { label: 'Comissões (custo variável)', cents: d.commissionsCents, minus: true },
        { label: 'Margem de contribuição', cents: d.contributionCents, strong: true, hint: d.netRevenueCents > 0 ? `${pct(d.contributionBps)} da receita líquida` : undefined },
        { label: 'Despesas fixas', cents: d.fixedExpensesCents, minus: true },
        { label: 'Resultado', cents: d.resultCents, strong: true, hint: d.netRevenueCents > 0 ? `${pct(d.resultBps)} da receita líquida` : undefined },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="DRE"
        subtitle={range ? `${formatDateShort(range.from)} a ${formatDateShort(range.to)}` : 'Resultado do período'}
      />
      <FinanceTabs />
      <div className="space-y-6 px-6 pb-8 lg:px-8">
        <PeriodPicker period={period} />
        {isLoading || !d ? (
          <Skeleton className="h-96 rounded-3xl" />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up sm:px-6 lg:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Receita líquida</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(d.netRevenueCents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Margem</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(d.contributionCents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Despesas</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(d.fixedExpensesCents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Resultado</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(d.resultCents)}</p>
                </div>
              </div>
            </section>
            <Card>
              <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Do faturamento ao resultado</h2>
              <table className="w-full text-sm">
                <caption className="sr-only">DRE gerencial do período</caption>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => (
                    <tr key={l.label} className={l.strong ? 'font-bold' : undefined}>
                      <th scope="row" className="py-2.5 text-left font-[inherit]">
                        <span className={l.strong ? '' : 'pl-3 font-normal text-muted-foreground'}>
                          {l.minus ? '(−) ' : ''}
                          {l.label}
                        </span>
                        {l.hint ? <span className="block text-xs font-normal text-muted-foreground">{l.hint}</span> : null}
                      </th>
                      <td className={`py-2.5 text-right tabular ${l.strong && l.cents < 0 ? 'text-danger' : ''}`}>
                        {l.minus && l.cents ? '− ' : ''}
                        {formatBRL(l.cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                Receitas e comissões das comandas pagas no período; despesas pelas contas pagas no período.
              </p>
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-extrabold">Despesas por categoria</h2>
              {d.expensesByCategory.length ? (
                <HBars rows={d.expensesByCategory.map((e) => ({ label: e.name, valueCents: e.cents }))} />
              ) : (
                <p className="text-muted-foreground">Nenhuma conta paga no período. Marque as contas como pagas em “Contas”.</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
