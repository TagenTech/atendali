'use client';

import { WEEKDAY_LABEL, WEEKDAY_SHORT, type BusinessHours, type TimeRange } from '@agendei/contracts';
import { Copy, Plus, X } from 'lucide-react';
import { ToggleTrack } from '@/components/ui/toggle-track';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // a semana começa na segunda

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="time"
      step={900}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-[6.5rem] rounded-xl border-2 border-input bg-card px-2 text-center tabular outline-none focus:border-primary"
    />
  );
}

/** Dias da semana com faixas de horário (ex.: almoço = duas faixas). Dia sem faixa = fechado. */
export function BusinessHoursEditor({ value, onChange }: { value: BusinessHours; onChange: (v: BusinessHours) => void }) {
  const setDay = (day: number, ranges: TimeRange[]) => onChange(value.map((r, i) => (i === day ? ranges : r)));
  const copyToWeekdays = (day: number) => onChange(value.map((r, i) => (i >= 1 && i <= 5 ? value[day].map((x) => ({ ...x })) : r)));

  return (
    <ul className="divide-y divide-border rounded-2xl border-2 border-input bg-card">
      {ORDER.map((day) => {
        const ranges = value[day];
        const open = ranges.length > 0;
        return (
          <li key={day} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={open}
              aria-label={`${WEEKDAY_LABEL[day]}: ${open ? 'aberto' : 'fechado'}`}
              onClick={() => setDay(day, open ? [] : [{ start: '09:00', end: '18:00' }])}
              className="flex w-24 items-center gap-2 font-semibold"
            >
              <ToggleTrack on={open} />
              {WEEKDAY_SHORT[day]}
            </button>
            {open ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {ranges.map((r, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <TimeInput label={`${WEEKDAY_LABEL[day]}: início da faixa ${i + 1}`} value={r.start} onChange={(start) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, start } : x)))} />
                    <span className="text-muted-foreground">às</span>
                    <TimeInput label={`${WEEKDAY_LABEL[day]}: fim da faixa ${i + 1}`} value={r.end} onChange={(end) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, end } : x)))} />
                    {ranges.length > 1 ? (
                      <button type="button" aria-label="Remover faixa" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </span>
                ))}
                {ranges.length < 4 ? (
                  <button
                    type="button"
                    aria-label={`Adicionar faixa em ${WEEKDAY_LABEL[day]}`}
                    title="Adicionar faixa (ex.: depois do almoço)"
                    onClick={() => setDay(day, [...ranges, { start: ranges.at(-1)!.end, end: '20:00' }])}
                    className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary-soft"
                  >
                    <Plus className="size-4" />
                  </button>
                ) : null}
                {day === 1 ? (
                  <button type="button" onClick={() => copyToWeekdays(1)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary-soft">
                    <Copy className="size-3.5" /> Copiar para seg–sex
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-muted-foreground">Fechado</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
