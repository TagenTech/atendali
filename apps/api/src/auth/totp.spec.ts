import { base32Decode, base32Encode, generateRecoveryCodes, hotp, otpauthUrl, verifyTotp } from './totp';

describe('TOTP (RFC 6238)', () => {
  // Vetor de teste da RFC 6238/4226: segredo ASCII "12345678901234567890".
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('base32 ida e volta', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('HOTP bate com a RFC 4226', () => {
    expect(['755224', '287082', '359152', '969429'].map((_, i) => hotp(secret, i))).toEqual([
      '755224',
      '287082',
      '359152',
      '969429',
    ]);
  });

  it('TOTP bate com a RFC 6238 (T=59s → 94287082, 6 dígitos = 287082)', () => {
    expect(verifyTotp(secret, '287082', 59_000)).toBe(1);
  });

  it('aceita ±30 s, recusa fora da janela e reuso do mesmo passo', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, hotp(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, hotp(secret, step - 2), now)).toBeNull();
    expect(verifyTotp(secret, hotp(secret, step), now, step)).toBeNull();
    expect(verifyTotp(secret, 'abc123', now)).toBeNull();
  });

  it('otpauth e códigos de recuperação', () => {
    expect(otpauthUrl('ABC', 'f@x.com')).toBe('otpauth://totp/Skedulei%3Af%40x.com?secret=ABC&issuer=Skedulei&algorithm=SHA1&digits=6&period=30');
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/));
  });
});
