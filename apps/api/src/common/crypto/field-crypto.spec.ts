import { blindIndex, decryptField, encryptField } from './field-crypto';

describe('field-crypto', () => {
  beforeAll(() => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('cifra e decifra; o texto não aparece no valor guardado', () => {
    const c = encryptField('52998224725');
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain('52998224725');
    expect(decryptField(c)).toBe('52998224725');
  });

  it('IV aleatório: o mesmo valor gera cifras diferentes', () => {
    expect(encryptField('x')).not.toBe(encryptField('x'));
  });

  it('detecta adulteração (GCM)', () => {
    const c = encryptField('52998224725');
    const buf = Buffer.from(c.slice(3), 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => decryptField(`v1:${buf.toString('base64')}`)).toThrow();
  });

  it('índice cego é estável e não reversível', () => {
    expect(blindIndex('52998224725', 'cpf')).toBe(blindIndex('52998224725', 'cpf'));
    expect(blindIndex('52998224725', 'cpf')).not.toBe(blindIndex('52998224726', 'cpf'));
    expect(blindIndex('52998224725', 'cpf')).toHaveLength(64);
  });

  it('exige chave de 32 bytes', () => {
    const old = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'curta';
    expect(() => encryptField('x')).toThrow(/DATA_ENCRYPTION_KEY/);
    process.env.DATA_ENCRYPTION_KEY = old;
  });
});
