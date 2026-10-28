'use client';

import { formatBRL } from '@agendei/contracts';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** "R$ 1,2 mil" — eixo compacto. */
const compact = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100);

/** Arredonda o topo do eixo para um número "limpo". */
function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Colunas por dia (uma série: o título já diz o que é, sem legenda).
 * Barras ≤ 24px, ponta arredondada de 4px, dica ao passar/focar, tabela equivalente abaixo.
 */
export function DailyColumns({ data, label }: { data: { date: string; revenueCents: number }[]; label: string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.revenueCents), 0));
  const best = data.reduce((b, d, i) => (d.revenueCents > (data[b]?.revenueCents ?? -1) ? i : b), 0);
  const ticks = [0, max / 2, max];
  const day = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

  return (
    <figure className="space-y-3">
      <div className="relative flex h-48 gap-2">
        <div className="flex w-14 shrink-0 flex-col-reverse justify-between text-right text-xs text-muted-foreground tabular" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-1/2">
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-0.5 border-b border-[var(--chart-grid)]" role="list" aria-label={label}>
          {[0.5, 1].map((f) => (
            <span key={f} className="pointer-events-none absolute inset-x-0 border-t border-[var(--chart-grid)]" style={{ bottom: `${f * 100}%` }} aria-hidden />
          ))}
          {data.map((d, i) => (
            <div
              key={d.date}
              role="listitem"
              tabIndex={0}
              aria-label={`${day(d.date)}: ${formatBRL(d.revenueCents)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
            >
              <span
                className={cn('w-full max-w-6 rounded-t-[4px] bg-[var(--chart-1)] transition-opacity', hover !== null && hover !== i && 'opacity-50')}
                style={{ height: `${(d.revenueCents / max) * 100}%`, minHeight: d.revenueCents ? 2 : 0 }}
              />
              {i === best && d.revenueCents > 0 && hover === null ? (
                <span className="absolute -top-1 -translate-y-full whitespace-nowrap text-xs font-semibold text-muted-foreground tabular" style={{ bottom: `${(d.revenueCents / max) * 100}%`, top: 'auto' }}>
                  {compact(d.revenueCents)}
                </span>
              ) : null}
              {hover === i ? (
                <span
                  role="tooltip"
                  className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-soft"
                >
                  <span className="block text-muted-foreground">{day(d.date)}</span>
                  <span className="block font-semibold tabular">{formatBRL(d.revenueCents)}</span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-16 text-xs text-muted-foreground" aria-hidden>
        <span>{day(data[0].date)}</span>
        {data.length > 2 ? <span>{day(data[Math.floor(data.length / 2)].date)}</span> : null}
        <span>{day(data[data.length - 1].date)}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver em tabela</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">{label}</caption>
          <tbody className="divide-y divide-border">
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="py-1 text-left font-normal">
                  {day(d.date)}
                </th>
                <td className="py-1 text-right tabular">{formatBRL(d.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Barras horizontais com o valor na ponta (texto em tinta neutra, nunca na cor da barra). */
export function HBars({ rows }: { rows: { label: string; valueCents: number; hint?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.valueCents), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1" title={`${r.label}: ${formatBRL(r.valueCents)}${r.hint ? ` · ${r.hint}` : ''}`}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular">
              {formatBRL(r.valueCents)}
              {r.hint ? <span className="ml-1 font-normal text-muted-foreground">{r.hint}</span> : null}
            </span>
          </div>
          <div className="h-3 rounded-r-[4px] bg-muted">
            <div className="h-3 rounded-r-[4px] bg-[var(--chart-1)]" style={{ width: `${(r.valueCents / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const dayLabel = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/**
 * Resultado (entradas − saídas) por dia ou semana. Uma série só, na mesma cor: o que fica acima da linha do zero
 * sobrou, o que fica abaixo faltou. Barras ≤ 24px, dica ao passar/focar e tabela equivalente embaixo.
 */
export function FlowColumns({
  buckets,
  label,
}: {
  buckets: { start: string; end: string; inCents: number; outCents: number; netCents: number; balanceCents: number }[];
  label: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const hi = niceMax(Math.max(...buckets.map((b) => b.netCents), 0));
  const minNet = Math.min(...buckets.map((b) => b.netCents), 0);
  const lo = minNet < 0 ? -niceMax(-minNet) : 0;
  const span = hi - lo;
  const zero = (-lo / span) * 100;
  const range = (b: { start: string; end: string }) => (b.start === b.end ? dayLabel(b.start) : `${dayLabel(b.start)} a ${dayLabel(b.end)}`);

  return (
    <figure className="space-y-3">
      <div className="relative flex h-48 gap-2">
        <div className="relative w-14 shrink-0 text-right text-xs text-muted-foreground tabular" aria-hidden>
          {[hi, 0, ...(lo < 0 ? [lo] : [])].map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${((t - lo) / span) * 100}%`, transform: 'translateY(50%)' }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 gap-0.5" role="list" aria-label={label}>
          <span className="pointer-events-none absolute inset-x-0 border-t border-[var(--chart-grid)]" style={{ bottom: '100%' }} aria-hidden />
          <span className="pointer-events-none absolute inset-x-0 border-t-2 border-[var(--chart-grid)]" style={{ bottom: `${zero}%` }} aria-hidden />
          {buckets.map((b, i) => (
            <div
              key={b.start}
              role="listitem"
              tabIndex={0}
              aria-label={`${range(b)}: entrou ${formatBRL(b.inCents)}, saiu ${formatBRL(b.outCents)}, resultado ${formatBRL(b.netCents)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative flex-1 cursor-default outline-none"
            >
              <span
                className={cn(
                  'absolute left-1/2 w-full max-w-6 -translate-x-1/2 bg-[var(--chart-1)] transition-opacity',
                  b.netCents >= 0 ? 'rounded-t-[4px]' : 'rounded-b-[4px]',
                  hover !== null && hover !== i && 'opacity-50',
                )}
                style={
                  b.netCents >= 0
                    ? { bottom: `${zero}%`, height: `${(b.netCents / span) * 100}%`, minHeight: b.netCents ? 2 : 0 }
                    : { top: `${100 - zero}%`, height: `${(-b.netCents / span) * 100}%`, minHeight: 2 }
                }
              />
              {hover === i ? (
                <span
                  role="tooltip"
                  className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-soft"
                >
                  <span className="block text-muted-foreground">{range(b)}</span>
                  <span className="block tabular">Entrou {formatBRL(b.inCents)}</span>
                  <span className="block tabular">Saiu {formatBRL(b.outCents)}</span>
                  <span className="block font-semibold tabular">Resultado {formatBRL(b.netCents)}</span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-16 text-xs text-muted-foreground" aria-hidden>
        <span>{dayLabel(buckets[0].start)}</span>
        <span>{dayLabel(buckets[buckets.length - 1].end)}</span>
      </div>
      <details className="text-sm" open>
        <summary className="cursor-pointer text-muted-foreground">Tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem]">
            <caption className="sr-only">{label}</caption>
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-1 font-bold">Período</th>
                <th className="py-1 text-right font-bold">Entrou</th>
                <th className="py-1 text-right font-bold">Saiu</th>
                <th className="py-1 text-right font-bold">Resultado</th>
                <th className="py-1 text-right font-bold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {buckets.map((b) => (
                <tr key={b.start}>
                  <th scope="row" className="py-1 text-left font-normal">
                    {range(b)}
                  </th>
                  <td className="py-1 text-right tabular">{formatBRL(b.inCents)}</td>
                  <td className="py-1 text-right tabular">{formatBRL(b.outCents)}</td>
                  <td className="py-1 text-right tabular">{formatBRL(b.netCents)}</td>
                  <td className="py-1 text-right font-semibold tabular">{formatBRL(b.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
