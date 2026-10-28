import { formatBRL, parseBRL } from './money';

describe('money', () => {
  it('formata centavos em BRL', () => {
    expect(formatBRL(28000).replace(/\s/g, ' ')).toBe('R$ 280,00');
  });

  it.each([
    ['280', 28000],
    ['280,5', 28050],
    ['R$ 1.280,50', 128050],
    ['99.90', 9990],
    ['', null],
    ['abc', null],
  ])('parseBRL(%p) = %p', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });
});
