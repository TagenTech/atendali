'use client';

import { formatBRL, PAYMENT_METHOD_LABEL } from '@skedulei/contracts';
import { DailyColumns, HBars } from '@/components/finance/charts';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { PeriodPicker, usePeriod } from '@/components/finance/period';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
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
    <>
      <PageHeader title="Financeiro" subtitle="Comandas pagas no período" />
      <FinanceTabs />
      <div className="space-y-6 px-5">
        <PeriodPicker period={period} />

        {isLoading || !s ? (
          <Skeleton className="h-80 rounded-3xl" />
        ) : (
          <>
            <KpiStrip cols={6}>
              <Kpi label="Faturamento" value={formatBRL(s.revenueCents)} hint={s.discountsCents ? `${formatBRL(s.discountsCents)} em descontos` : undefined} />
              <Kpi label="Taxas de pagamento" value={formatBRL(s.feesCents)} />
              <Kpi label="Líquido" value={formatBRL(s.netCents)} />
              <Kpi label="Comissões" value={formatBRL(s.commissionsCents)} />
              <Kpi label="Ticket médio" value={formatBRL(s.averageTicketCents)} />
              <Kpi label="Comandas pagas" value={String(s.orders)} />
            </KpiStrip>

            {!s.orders ? (
              <EmptyState title="Sem vendas no período" description="Os números aparecem quando as comandas são pagas no Caixa." />
            ) : (
              <>
                {s.byDay.length > 1 ? (
                  <Card>
                    <h2 className="mb-4 text-lg font-extrabold">Faturamento por dia</h2>
                    <DailyColumns data={s.byDay} label="Faturamento por dia" />
                  </Card>
                ) : null}
                <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
                  <Card>
                    <h2 className="mb-4 text-lg font-extrabold">Por forma de pagamento</h2>
                    <HBars
                      rows={s.byMethod.map((m) => ({
                        label: PAYMENT_METHOD_LABEL[m.method],
                        valueCents: m.amountCents,
                        hint: m.feesCents ? `taxa ${formatBRL(m.feesCents)}` : undefined,
                      }))}
                    />
                  </Card>
                  <Card className="overflow-x-auto">
                    <h2 className="mb-3 text-lg font-extrabold">Por profissional</h2>
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
                            <td className="py-2 font-semibold">{p.name}</td>
                            <td className="whitespace-nowrap py-2 pl-3 text-right tabular">{p.items}</td>
                            <td className="whitespace-nowrap py-2 pl-3 text-right tabular">{formatBRL(p.revenueCents)}</td>
                            <td className="whitespace-nowrap py-2 pl-3 text-right tabular">{formatBRL(p.commissionsCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
                <Card className="overflow-x-auto">
                  <h2 className="mb-3 text-lg font-extrabold">Mais vendidos</h2>
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
                          <td className="py-2">{x.name}</td>
                          <td className="whitespace-nowrap py-2 pl-3 text-right tabular">{x.quantity}</td>
                          <td className="whitespace-nowrap py-2 pl-3 text-right tabular">{formatBRL(x.revenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
