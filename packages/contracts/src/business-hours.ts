/**
 * Horário de funcionamento: 7 posições (0 = domingo … 6 = sábado), cada uma com
 * faixas 'HH:mm' em ordem e sem sobreposição. Dia sem faixas = fechado.
 */

export interface TimeRange {
  start: string;
  end: string;
}

export type BusinessHours = TimeRange[][];

export const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Seg a sex 9h–19h, sábado 9h–14h, domingo fechado. */
export function defaultBusinessHours(): BusinessHours {
  const weekday = [{ start: '09:00', end: '19:00' }];
  return [[], weekday, weekday, weekday, weekday, weekday, [{ start: '09:00', end: '14:00' }]].map((d) => d.map((r) => ({ ...r })));
}

/** Mensagem do primeiro problema encontrado, ou null se está tudo certo. */
export function validateBusinessHours(hours: unknown): string | null {
  if (!Array.isArray(hours) || hours.length !== 7) return 'Informe os 7 dias da semana';
  for (let d = 0; d < 7; d++) {
    const ranges = hours[d];
    if (!Array.isArray(ranges) || ranges.length > 4) return `${WEEKDAY_LABEL[d]}: até 4 faixas de horário`;
    let lastEnd = -1;
    for (const r of ranges as TimeRange[]) {
      if (!r || !HHMM.test(r.start) || !HHMM.test(r.end)) return `${WEEKDAY_LABEL[d]}: horário inválido`;
      const s = toMinutes(r.start);
      const e = toMinutes(r.end);
      if (e <= s) return `${WEEKDAY_LABEL[d]}: o fim precisa ser depois do início`;
      if (s < lastEnd) return `${WEEKDAY_LABEL[d]}: faixas sobrepostas ou fora de ordem`;
      lastEnd = e;
    }
  }
  return null;
}

/** "09:00–12:00, 13:00–19:00" ou "Fechado". */
export function describeDay(ranges: TimeRange[]): string {
  return ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(', ') : 'Fechado';
}

const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Horário efetivo de quem atende: a interseção do horário da unidade com o do profissional
 * (ninguém atende com a unidade fechada). Sem horário próprio, vale o da unidade.
 */
export function effectiveHours(unit: BusinessHours, member: BusinessHours | null | undefined): BusinessHours {
  if (!member) return unit;
  return unit.map((unitRanges, day) => {
    const out: TimeRange[] = [];
    for (const u of unitRanges) {
      for (const m of member[day] ?? []) {
        const start = Math.max(toMinutes(u.start), toMinutes(m.start));
        const end = Math.min(toMinutes(u.end), toMinutes(m.end));
        if (end > start) out.push({ start: fromMinutes(start), end: fromMinutes(end) });
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  });
}
