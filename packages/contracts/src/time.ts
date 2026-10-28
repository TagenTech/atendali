/**
 * Horários com fuso. Instantes trafegam como ISO UTC ('2026-10-23T22:00:00.000Z');
 * datas de calendário como 'YYYY-MM-DD' e horas como 'HH:mm', sempre no fuso do professor.
 */
import { addDays, type IsoDate } from './dates';

export type HHmm = string;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHHmm = (v: unknown): v is HHmm => typeof v === 'string' && HHMM.test(v);

const partsFormatter = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string) {
  let f = partsFormatter.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatter.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  date: IsoDate;
  time: HHmm;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  minutes: number;
}

export function zonedParts(instant: Date, tz: string): ZonedParts {
  const p = Object.fromEntries(formatterFor(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return { date, time, weekday: weekdayOf(date), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Diferença (ms) entre o relógio do fuso e UTC naquele instante. */
function offsetMs(instant: Date, tz: string): number {
  const p = Object.fromEntries(formatterFor(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Data + hora no fuso do professor → instante UTC (correto mesmo em horário de verão). */
export function zonedToUtc(date: IsoDate, time: HHmm, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(first), tz));
}

export function weekdayOf(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Segunda-feira da semana de `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export type YearMonth = string; // 'YYYY-MM'

export const monthOf = (date: IsoDate): YearMonth => date.slice(0, 7);

export function addMonths(month: YearMonth, n: number): YearMonth {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(month: YearMonth): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const firstDayOf = (month: YearMonth): IsoDate => `${month}-01`;
export const lastDayOf = (month: YearMonth): IsoDate => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

/** Dia `day` do mês (limitado ao último dia). */
export function dayOfMonth(month: YearMonth, day: number): IsoDate {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** '2026-10' → 'outubro de 2026' (ou 'outubro'). */
export function monthLabel(month: YearMonth, withYear = true): string {
  const [y, m] = month.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} de ${y}` : MONTHS[m - 1];
}

/** Duração legível: 60 → '1h', 90 → '1h30', 45 → '45 min'. */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}

export function addMinutesToHHmm(time: HHmm, minutes: number): HHmm {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Dias inteiros entre duas datas (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
