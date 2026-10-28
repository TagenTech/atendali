import {
  addMinutesToHHmm,
  addMonths,
  dayOfMonth,
  diffDays,
  formatDuration,
  monthLabel,
  startOfWeek,
  weekdayOf,
  zonedParts,
  zonedToUtc,
} from './time';

describe('time', () => {
  it('zonedToUtc converte horário de São Paulo para UTC', () => {
    expect(zonedToUtc('2026-10-23', '19:00', 'America/Sao_Paulo').toISOString()).toBe('2026-10-23T22:00:00.000Z');
  });

  it('zonedToUtc respeita horário de verão (Nova York)', () => {
    expect(zonedToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(zonedToUtc('2026-01-15', '09:00', 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('zonedParts é o inverso', () => {
    const p = zonedParts(new Date('2026-10-23T22:30:00Z'), 'America/Sao_Paulo');
    expect(p).toEqual({ date: '2026-10-23', time: '19:30', weekday: 5, minutes: 19 * 60 + 30 });
  });

  it('semana começa na segunda', () => {
    expect(weekdayOf('2026-10-25')).toBe(0);
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });

  it('meses', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(dayOfMonth('2026-02', 30)).toBe('2026-02-28');
    expect(monthLabel('2026-10')).toBe('outubro de 2026');
  });

  it('utilitários', () => {
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(45)).toBe('45 min');
    expect(addMinutesToHHmm('23:30', 60)).toBe('00:30');
    expect(diffDays('2026-10-01', '2026-10-23')).toBe(22);
  });
});
