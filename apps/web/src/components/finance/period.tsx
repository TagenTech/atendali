'use client';

import { addDays, addMonths, firstDayOf, lastDayOf, monthOf, todayIn } from '@skedulei/contracts';
import * as React from 'react';
import { Chip } from '@/components/ui/chip';
import { useOrg } from '@/lib/org';
import { useHydrated } from '@/lib/use-hydrated';

type Preset = 'hoje' | '7d' | 'mes' | 'mes-passado' | 'outro';

const LABELS: [Preset, string][] = [
  ['hoje', 'Hoje'],
  ['7d', '7 dias'],
  ['mes', 'Este mês'],
  ['mes-passado', 'Mês passado'],
  ['outro', 'Outro'],
];

/** Período escolhido (no fuso da unidade). `range` é null até o navegador saber a data de hoje. */
export function usePeriod(initial: Preset = 'mes') {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn(org.timezone) : null;
  const [preset, setPreset] = React.useState<Preset>(initial);
  const [custom, setCustom] = React.useState<{ from: string; to: string } | null>(null);

  const range = (() => {
    if (!today) return null;
    if (preset === 'hoje') return { from: today, to: today };
    if (preset === '7d') return { from: addDays(today, -6), to: today };
    if (preset === 'mes') return { from: firstDayOf(monthOf(today)), to: today };
    if (preset === 'mes-passado') {
      const m = addMonths(monthOf(today), -1);
      return { from: firstDayOf(m), to: lastDayOf(m) };
    }
    return custom ?? { from: firstDayOf(monthOf(today)), to: today };
  })();
  return { preset, setPreset, range, setCustom, today };
}

export function PeriodPicker({ period }: { period: ReturnType<typeof usePeriod> }) {
  const { preset, setPreset, range, setCustom } = period;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
      {LABELS.map(([k, label]) => (
        <Chip key={k} active={preset === k} onClick={() => setPreset(k)}>
          {label}
        </Chip>
      ))}
      {preset === 'outro' && range ? (
        <span className="flex items-center gap-2 text-sm">
          <input
            type="date"
            aria-label="De"
            value={range.from}
            onChange={(e) => e.target.value && setCustom({ from: e.target.value, to: range.to })}
            className="h-9 rounded-xl border-2 border-input bg-card px-2"
          />
          até
          <input
            type="date"
            aria-label="Até"
            value={range.to}
            onChange={(e) => e.target.value && setCustom({ from: range.from, to: e.target.value })}
            className="h-9 rounded-xl border-2 border-input bg-card px-2"
          />
        </span>
      ) : null}
    </div>
  );
}
