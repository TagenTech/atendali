import {
  allocate,
  cashExpected,
  changeFor,
  commissionRate,
  commissionsFor,
  orderTotals,
  paymentFee,
  paymentMethodsOf,
} from './finance';

describe('allocate', () => {
  it('reparte sem perder centavo', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [3000, 1000])).toEqual([750, 250]);
    expect(allocate(7, [0, 0])).toEqual([0, 0]);
    const parts = allocate(999, [123, 456, 789]);
    expect(parts.reduce((s, v) => s + v, 0)).toBe(999);
  });
});

describe('comanda', () => {
  const items = [
    { quantity: 1, unitPriceCents: 8000, discountCents: 0 },
    { quantity: 2, unitPriceCents: 3500, discountCents: 1000 },
  ];

  it('totais com desconto do item e da comanda', () => {
    const t = orderTotals(items, 1400, [{ amountCents: 5000 }]);
    expect(t).toMatchObject({ subtotalCents: 15000, discountCents: 2400, totalCents: 12600, paidCents: 5000, dueCents: 7600 });
    // Desconto da comanda (1400) repartido 8000 : 6000 → 800 : 600.
    expect(t.itemNetCents).toEqual([7200, 5400]);
  });

  it('desconto nunca deixa o total negativo; pago a mais não gera "falta" negativa', () => {
    const t = orderTotals(items, 999_999, [{ amountCents: 1 }]);
    expect(t.totalCents).toBe(0);
    expect(t.dueCents).toBe(0);
  });

  it('troco', () => {
    expect(changeFor(10000, 7600)).toBe(2400);
    expect(changeFor(5000, 7600)).toBe(0);
  });
});

describe('formas de pagamento', () => {
  it('taxa percentual + fixa, arredondada, limitada ao valor', () => {
    expect(paymentFee(10000, { feeBps: 349, feeFixedCents: 0 })).toBe(349);
    expect(paymentFee(1999, { feeBps: 199, feeFixedCents: 0 })).toBe(40);
    expect(paymentFee(100, { feeBps: 0, feeFixedCents: 500 })).toBe(100);
    expect(paymentFee(0, { feeBps: 500, feeFixedCents: 50 })).toBe(0);
  });

  it('completa a configuração salva com os padrões', () => {
    const cfg = paymentMethodsOf([{ method: 'CARTAO_CREDITO', enabled: true, feeBps: 299, feeFixedCents: 0, settlementDays: 2 }]);
    expect(cfg).toHaveLength(6);
    expect(cfg.find((c) => c.method === 'CARTAO_CREDITO')!.feeBps).toBe(299);
    expect(cfg.find((c) => c.method === 'PIX')!.enabled).toBe(true);
  });
});

describe('comissão', () => {
  it('percentual do serviço vence o do profissional', () => {
    expect(commissionRate(5000, 4000)).toBe(5000);
    expect(commissionRate(null, 4000)).toBe(4000);
    expect(commissionRate(undefined, undefined)).toBe(0);
  });

  it('base bruta x líquida (taxas repartidas entre os itens)', () => {
    const items = [
      { netCents: 7200, bps: 5000, memberId: 'a' },
      { netCents: 5400, bps: 4000, memberId: 'b' },
      { netCents: 1000, bps: 5000, memberId: null },
    ];
    expect(commissionsFor(items, 'BRUTO', 340)).toEqual([
      { baseCents: 7200, amountCents: 3600 },
      { baseCents: 5400, amountCents: 2160 },
      { baseCents: 1000, amountCents: 0 },
    ]);
    const liquid = commissionsFor(items, 'LIQUIDO', 340);
    expect(liquid.map((c) => c.baseCents).reduce((s, v) => s + v, 0)).toBe(7200 + 5400 + 1000 - 340);
    expect(liquid[0]).toEqual({ baseCents: 7020, amountCents: 3510 });
  });
});

describe('caixa', () => {
  it('esperado na gaveta: abertura + dinheiro + suprimento − sangria', () => {
    const e = cashExpected({
      openingCents: 10000,
      payments: [
        { method: 'DINHEIRO', amountCents: 5000 },
        { method: 'PIX', amountCents: 8000 },
        { method: 'DINHEIRO', amountCents: 2500 },
      ],
      movements: [
        { kind: 'SANGRIA', amountCents: 6000 },
        { kind: 'SUPRIMENTO', amountCents: 1000 },
      ],
    });
    expect(e.drawerCents).toBe(12500);
    expect(e.byMethod).toMatchObject({ DINHEIRO: 7500, PIX: 8000, CARTAO_CREDITO: 0 });
  });
});
