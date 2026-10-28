import { dialNumber, formatPhone, isInternationalPhone, isValidPhone, normalizePhone, whatsappLink } from './phone';

describe('phone', () => {
  it('normaliza e remove DDI 55', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
  });
  it('valida celular e fixo', () => {
    expect(isValidPhone('11987654321')).toBe(true);
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('1198765')).toBe(false);
  });
  it('mascara progressivamente', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119876')).toBe('(11) 9876');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });
  it('gera link do WhatsApp', () => {
    expect(whatsappLink('11987654321', 'Oi!')).toBe('https://wa.me/5511987654321?text=Oi!');
  });

  describe('outros países', () => {
    it('guarda no formato E.164 com "+"', () => {
      expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizePhone('+44 7911 123456')).toBe('+447911123456');
      expect(normalizePhone('  +351 912 345 678 ')).toBe('+351912345678');
    });
    it('aceita 00 no lugar do "+"', () => {
      expect(normalizePhone('00 44 7911 123456')).toBe('+447911123456');
    });
    it('+55 completo vira número brasileiro; incompleto fica como está na digitação', () => {
      expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
      expect(normalizePhone('+55 11 3333-4444')).toBe('1133334444');
      expect(normalizePhone('+5511')).toBe('+5511');
      expect(normalizePhone('+')).toBe('+');
    });
    it('não corta número longo demais: ele é recusado, não "consertado"', () => {
      expect(normalizePhone('+123456789012345678')).toBe('+123456789012345678');
      expect(isValidPhone('+123456789012345678')).toBe(false);
    });
    it('valida o formato internacional', () => {
      expect(isInternationalPhone('+14155552671')).toBe(true);
      expect(isInternationalPhone('11987654321')).toBe(false);
      expect(isValidPhone('+14155552671')).toBe(true);
      expect(isValidPhone('+447911123456')).toBe(true);
      expect(isValidPhone('+1415')).toBe(false); // curto demais
      expect(isValidPhone('+0123456789')).toBe(false); // código de país não começa com 0
      expect(isValidPhone('+1234567890123456')).toBe(false); // mais de 15 dígitos
      expect(isValidPhone('+5511987654321')).toBe(false); // Brasil não é guardado com +55
      expect(isValidPhone('+')).toBe(false);
    });
    it('mascara por país', () => {
      expect(formatPhone('+')).toBe('+');
      expect(formatPhone('+1')).toBe('+1');
      expect(formatPhone('+14155552671')).toBe('+1 415 555 2671');
      expect(formatPhone('+447911123456')).toBe('+44 791 112 3456');
      expect(formatPhone('+351912345678')).toBe('+351 912 345 678');
      expect(formatPhone('+5')).toBe('+5');
    });
    it('número para discar leva o DDI certo', () => {
      expect(dialNumber('11987654321')).toBe('+5511987654321');
      expect(dialNumber('+447911123456')).toBe('+447911123456');
    });
    it('gera link do WhatsApp sem o 55', () => {
      expect(whatsappLink('+14155552671')).toBe('https://wa.me/14155552671');
      expect(whatsappLink('+447911123456', 'Hi!')).toBe('https://wa.me/447911123456?text=Hi!');
    });
  });

  describe('número colado de contatos, WhatsApp e sites', () => {
    const br = '11987654321';
    it.each([
      ['(11) 98765-4321'],
      ['11 98765-4321'],
      ['11-98765-4321'],
      ['11.98765.4321'],
      ['11 9 8765-4321'],
      ['+55 (11) 98765-4321'],
      ['+55 11 98765-4321'],
      ['+5511987654321'],
      ['5511987654321'],
      ['55 11 98765-4321'],
      ['0055 11 98765-4321'],
      ['011 98765-4321'],
      ['(011) 98765-4321'],
      ['0 11 98765-4321'],
      ['  11 98765-4321  '],
      ['11\u00a098765-4321'], // espaço sem quebra
      ['\u202a+55 11 98765-4321\u202c'], // marcas de direção que o iPhone/WhatsApp colocam
      ['\u200e(11) 98765-4321'],
      ['tel: 11 98765-4321'],
    ])('"%s" vira o número brasileiro', (pasted) => {
      expect(normalizePhone(pasted)).toBe(br);
      expect(isValidPhone(normalizePhone(pasted))).toBe(true);
    });
    it('fixo colado também vale', () => {
      expect(normalizePhone('(11) 3333-4444')).toBe('1133334444');
      expect(normalizePhone('+55 11 3333-4444')).toBe('1133334444');
      expect(normalizePhone('011 3333-4444')).toBe('1133334444');
    });
    it('internacional colado com marcas invisíveis continua internacional', () => {
      expect(normalizePhone('\u202a+44 7911 123456\u202c')).toBe('+447911123456');
      expect(normalizePhone('+44\u00a07911\u00a0123456')).toBe('+447911123456');
    });
  });
});
