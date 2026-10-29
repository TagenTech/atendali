import { describe, expect, it } from 'vitest';
import { capitalize, countdown, dateOf, relativeDay, timeOf } from './format';

describe('format', () => {
  it('hora e data no fuso do negócio', () => {
    expect(timeOf('2026-03-10T13:30:00Z', 'America/Sao_Paulo')).toBe('10:30');
    expect(dateOf('2026-03-10T01:30:00Z', 'America/Sao_Paulo')).toBe('2026-03-09');
  });

  it('relativeDay: hoje, amanhã, ontem e datas por extenso (com ano só se for outro)', () => {
    const args = ['2026-03-10', '2026-03-11', '2026-03-09'] as const;
    expect(relativeDay('2026-03-10', ...args)).toBe('Hoje');
    expect(relativeDay('2026-03-11', ...args)).toBe('Amanhã');
    expect(relativeDay('2026-03-09', ...args)).toBe('Ontem');
    const mesmoAno = relativeDay('2026-03-20', ...args);
    expect(mesmoAno).toMatch(/20/);
    expect(mesmoAno).not.toMatch(/2026/);
    expect(relativeDay('2027-03-20', ...args)).toMatch(/2027/);
  });

  it('countdown: agora, minutos, horas, dias', () => {
    const now = Date.parse('2026-03-10T12:00:00Z');
    const at = (min: number) => new Date(now + min * 60_000).toISOString();
    expect(countdown(at(-5), now)).toBe('agora');
    expect(countdown(at(0), now)).toBe('agora');
    expect(countdown(at(25), now)).toBe('em 25 min');
    expect(countdown(at(120), now)).toBe('em 2h');
    expect(countdown(at(130), now)).toBe('em 2h10');
    expect(countdown(at(3 * 24 * 60), now)).toBe('em 3 dia(s)');
  });

  it('capitalize', () => {
    expect(capitalize('quinta')).toBe('Quinta');
    expect(capitalize('')).toBe('');
  });
});
