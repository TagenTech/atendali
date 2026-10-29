'use client';

import { formatBRL, formatDateShort, PROJECTION_DAYS } from '@skedulei/contracts';
import * as React from 'react';
import { FlowColumns } from '@/components/finance/charts';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { PeriodPicker, usePeriod } from '@/components/finance/period';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { useCashflow } from '@/lib/queries/ledger';

export default function FluxoPage() {
  const [mode, setMode] = React.useState<'REALIZADO' | 'PROJETADO'>('PROJETADO');
  const [days, setDays] = React.useState<number>(30);
  const period = usePeriod('mes');
  const { range, today } = period;
  const realized = mode === 'REALIZADO';
  const ready = realized ? !!range : !!today;
  const { data: f, isLoading } = useCashflow(
    realized ? { mode, from: range?.from, to: range?.to } : { mode, days },
    ready,
  );

  return (
    <>
      <PageHeader title="Fluxo de caixa" subtitle={f ? `${formatDateShort(f.from)} a ${formatDateShort(f.to)}` : 'Entradas e saídas'} />
      <FinanceTabs />
      <div className="space-y-6 px-6 pb-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de fluxo">
          <Chip active={!realized} onClick={() => setMode('PROJETADO')}>
            Projetado
          </Chip>
          <Chip active={realized} onClick={() => setMode('REALIZADO')}>
            Realizado
          </Chip>
        </div>
        {realized ? (
          <PeriodPicker period={period} />
        ) : (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Próximos dias">
            {PROJECTION_DAYS.map((d) => (
              <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                {d} dias
              </Chip>
            ))}
          </div>
        )}

        {isLoading || !f ? (
          <Skeleton className="h-96 rounded-3xl" />
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up sm:px-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm text-white/65">{realized ? 'Entrou' : 'Vai entrar'}</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(f.inCents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/65">{realized ? 'Saiu' : 'Vai sair'}</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(f.outCents)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/65">Resultado</p>
                  <p className="mt-1 font-display text-xl font-extrabold tabular leading-none sm:text-2xl">{formatBRL(f.netCents)}</p>
                </div>
              </div>
            </section>
            <Card>
              <h2 className="mb-4 font-display text-lg font-extrabold tracking-tight">{realized ? 'Resultado por ' : 'Resultado previsto por '}{f.bucket === 'dia' ? 'dia' : 'semana'}</h2>
              <FlowColumns buckets={f.buckets} label={realized ? 'Fluxo de caixa realizado' : `Fluxo de caixa previsto para ${days} dias`} />
            </Card>
            <p className="text-sm text-muted-foreground">
              {realized
                ? 'Entradas: recebimentos baixados (PIX e dinheiro entram na hora; cartão quando cai). Saídas: contas pagas e fechamentos de comissão.'
                : 'Entradas: valores a receber na data prevista. Saídas: contas a pagar no vencimento. O que já venceu e não foi baixado entra hoje. Comissões em aberto não estão incluídas.'}
            </p>
          </>
        )}
      </div>
    </>
  );
}
