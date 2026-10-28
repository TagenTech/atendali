import { ageLabel, normalizePersonName, personKey, samePerson } from './guardian';

describe('responsável × paciente', () => {
  it('compara nomes sem acento, caixa e espaços', () => {
    expect(samePerson('  JOÃO   Silva ', 'joao silva')).toBe(true);
    expect(samePerson('Sofia Costa', 'Davi Costa')).toBe(false);
    expect(normalizePersonName('Zé  da Conceição')).toBe('ze da conceicao');
  });
  it('mesmo telefone com nomes diferentes são pessoas diferentes', () => {
    expect(personKey('11988887777', 'Sofia')).not.toBe(personKey('11988887777', 'Davi'));
    expect(personKey('11988887777', 'SOFIA')).toBe(personKey('11988887777', 'sofia'));
  });
  it('idade em meses até 2 anos e depois em anos', () => {
    expect(ageLabel('2026-09-20', '2026-10-28')).toBe('1 mês');
    expect(ageLabel('2026-10-10', '2026-10-28')).toBe('0 mês');
    expect(ageLabel('2025-04-10', '2026-10-28')).toBe('18 meses');
    expect(ageLabel('2021-10-29', '2026-10-28')).toBe('4 anos');
    expect(ageLabel('2021-10-28', '2026-10-28')).toBe('5 anos');
    expect(ageLabel(null, '2026-10-28')).toBeNull();
    expect(ageLabel('2030-01-01', '2026-10-28')).toBeNull();
  });
});
