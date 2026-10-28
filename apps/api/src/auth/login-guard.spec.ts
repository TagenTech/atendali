import { LoginAttempts, maskEmail } from './login-guard';

describe('LoginAttempts', () => {
  it('bloqueia o e-mail após 5 falhas e libera depois de 15 min', () => {
    let t = 0;
    const g = new LoginAttempts(() => t);
    for (let i = 0; i < 4; i++) expect(g.fail('A@x.com')).toBe(false);
    expect(g.lockedFor('a@x.com')).toBe(0);
    expect(g.fail('a@x.com')).toBe(true);
    expect(g.lockedFor('a@x.com')).toBe(15);
    t += 15 * 60_000 + 1;
    expect(g.lockedFor('a@x.com')).toBe(0);
  });

  it('sucesso zera o contador', () => {
    const g = new LoginAttempts(() => 0);
    for (let i = 0; i < 4; i++) g.fail('b@x.com');
    g.success('b@x.com');
    expect(g.fail('b@x.com')).toBe(false);
  });

  it('mascara e-mail para log', () => {
    expect(maskEmail('filipe@gmail.com')).toBe('fi***@gmail.com');
  });
});
