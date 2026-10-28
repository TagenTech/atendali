import { formatDateLong, WEEKDAYS, zonedParts, type IsoDate } from '@agendei/contracts';

export const timeOf = (iso: string, tz: string) => zonedParts(new Date(iso), tz).time;
export const dateOf = (iso: string, tz: string) => zonedParts(new Date(iso), tz).date;

/** 'Hoje', 'Amanhã', 'Ontem' ou 'quinta, 23 de outubro'. */
export function relativeDay(date: IsoDate, today: IsoDate, tomorrow: IsoDate, yesterday: IsoDate): string {
  if (date === today) return 'Hoje';
  if (date === tomorrow) return 'Amanhã';
  if (date === yesterday) return 'Ontem';
  const wd = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${wd}, ${formatDateLong(date, date.slice(0, 4) !== today.slice(0, 4))}`;
}

/** 'em 25 min', 'em 2h10', 'agora'. */
export function countdown(iso: string, now: number): string {
  const min = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (min <= 0) return 'agora';
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return `em ${Math.round(h / 24)} dia(s)`;
  return `em ${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
