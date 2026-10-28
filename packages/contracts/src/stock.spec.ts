import { abcClasses, averageCost, movementDelta, stockStatus } from './stock';

describe('estoque', () => {
  it('status: zerado, abaixo do mínimo, em dia', () => {
    expect(stockStatus(0, 5)).toBe('ZERADO');
    expect(stockStatus(-3, 0)).toBe('ZERADO');
    expect(stockStatus(5, 5)).toBe('BAIXO');
    expect(stockStatus(6, 5)).toBe('OK');
    expect(stockStatus(1, 0)).toBe('OK');
  });

  it('custo médio ponderado; estoque zerado adota o custo da entrada', () => {
    expect(averageCost(10, 1000, 10, 2000)).toBe(1500);
    expect(averageCost(3, 1000, 1, 2000)).toBe(1250);
    expect(averageCost(0, 1000, 5, 2000)).toBe(2000);
    expect(averageCost(-2, 1000, 5, 2000)).toBe(2000);
    expect(averageCost(10, 1000, 0, 5000)).toBe(1000);
  });

  it('delta de cada movimento; inventário leva o saldo até o contado', () => {
    expect(movementDelta('ENTRADA', 10, 4)).toBe(10);
    expect(movementDelta('SAIDA', 3, 4)).toBe(-3);
    expect(movementDelta('VENDA', 1, 0)).toBe(-1);
    expect(movementDelta('CONSUMO', 50, 200)).toBe(-50);
    expect(movementDelta('ESTORNO', 2, 0)).toBe(2);
    expect(movementDelta('AJUSTE', 7, 10)).toBe(-3);
    expect(movementDelta('AJUSTE', 12, 10)).toBe(2);
  });

  it('curva ABC pelo acumulado antes do item; valor zero é C', () => {
    const abc = abcClasses([
      { id: 'a', valueCents: 7000 },
      { id: 'b', valueCents: 1500 },
      { id: 'c', valueCents: 1000 },
      { id: 'd', valueCents: 500 },
      { id: 'z', valueCents: 0 },
    ]);
    // acumulado antes: a 0% → A; b 70% → A; c 85% → B; d 95% → C.
    expect(Object.fromEntries(abc)).toEqual({ a: 'A', b: 'A', c: 'B', d: 'C', z: 'C' });
    expect([...abcClasses([{ id: 'x', valueCents: 0 }]).values()]).toEqual(['C']);
  });
});
