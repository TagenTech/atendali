/**
 * Datas de calendário (sem hora) trafegam como texto ISO 'YYYY-MM-DD'.
 * "Hoje" sempre no fuso do professor, nunca no do servidor.
 */
import { DEFAULT_TIMEZONE } from './constants';

export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDate {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Idade completa em `today`. */
export function ageOn(birthDate: IsoDate, today: IsoDate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** '2026-03-05' → '5 mar 2026' (ou '5 mar' com `withYear: false`). */
export function formatDateShort(date: IsoDate, withYear = true): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** '2026-03-05' → '5 de março de 2026'. */
export function formatDateLong(date: IsoDate, withYear = true): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} de ${MONTHS_LONG[m - 1]}${withYear ? ` de ${y}` : ''}`;
}
