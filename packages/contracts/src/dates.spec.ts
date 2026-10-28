import { addDays, ageOn, formatDateShort, isIsoDate, todayIn } from './dates';

describe('dates', () => {
  it('todayIn usa o fuso do professor', () => {
    // 02:30 UTC de 23/10 ainda é 22/10 em São Paulo (UTC-3)
    const now = new Date('2026-10-23T02:30:00Z');
    expect(todayIn('America/Sao_Paulo', now)).toBe('2026-10-22');
    expect(todayIn('UTC', now)).toBe('2026-10-23');
  });

  it('addDays atravessa meses e anos', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('isIsoDate rejeita datas impossíveis', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28/02/2026')).toBe(false);
  });

  it('ageOn considera se já fez aniversário', () => {
    expect(ageOn('2010-10-23', '2026-10-22')).toBe(15);
    expect(ageOn('2010-10-23', '2026-10-23')).toBe(16);
  });

  it('formatDateShort', () => {
    expect(formatDateShort('2026-03-05')).toBe('5 mar 2026');
    expect(formatDateShort('2026-03-05', false)).toBe('5 mar');
  });
});
