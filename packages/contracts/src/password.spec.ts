import { isCommonPassword, passwordProblem } from './password';

describe('senha', () => {
  it('recusa senhas comuns, repetidas e em sequência', () => {
    for (const p of ['12345678', 'Password123', 'aaaaaaaa', '87654321', 'abcdefgh', '  senha123 ']) {
      expect(isCommonPassword(p)).toBe(true);
    }
  });
  it('aceita senhas normais', () => {
    for (const p of ['senha-forte-123', 'Cafe com leite 9', 'x7!kQp2m']) expect(isCommonPassword(p)).toBe(false);
  });
  it('mensagem na ordem: tamanho, comum, ok', () => {
    expect(passwordProblem('abc')).toMatch(/pelo menos 8/);
    expect(passwordProblem('12345678')).toMatch(/muito comum/);
    expect(passwordProblem('senha-forte-123')).toBeNull();
  });
});
