import { describe, expect, it } from 'vitest';
import { firstName, greeting, todayLabel } from './greeting';

const at = (h: number) => new Date(2026, 2, 10, h, 0, 0);

describe('greeting', () => {
  it('muda ao longo do dia', () => {
    expect(greeting(at(3)).text).toBe('Boa noite');
    expect(greeting(at(5)).text).toBe('Bom dia');
    expect(greeting(at(11)).text).toBe('Bom dia');
    expect(greeting(at(12)).text).toBe('Boa tarde');
    expect(greeting(at(17)).text).toBe('Boa tarde');
    expect(greeting(at(18)).text).toBe('Boa noite');
    expect(greeting(at(23)).emoji).toBe('🌙');
  });

  it('usa a hora de agora quando nada é passado', () => {
    expect(['Bom dia', 'Boa tarde', 'Boa noite']).toContain(greeting().text);
  });

  it('primeiro nome ignora espaços sobrando', () => {
    expect(firstName('  Ana   Souza ')).toBe('Ana');
    expect(firstName('Madonna')).toBe('Madonna');
    expect(firstName('')).toBe('');
  });

  it('data de hoje por extenso, com a primeira letra maiúscula', () => {
    const s = todayLabel(new Date(2026, 2, 10));
    expect(s.charAt(0)).toBe(s.charAt(0).toUpperCase());
    expect(s).toMatch(/10/);
    expect(todayLabel()).toBeTruthy();
  });
});
