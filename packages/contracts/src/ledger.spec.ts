import {
  buildCashFlow,
  buildDre,
  defaultChartOfAccounts,
  monthlyDates,
  payableStatus,
  projectedDate,
  receivableNet,
  receivableStatus,
  settlementDate,
} from './ledger';

describe('status calculado', () => {
  it('conta a pagar: pendente, atrasada ou paga', () => {
    expect(payableStatus({ dueDate: '2026-10-28', paidDate: null }, '2026-10-28')).toBe('PENDENTE');
    expect(payableStatus({ dueDate: '2026-10-27', paidDate: null }, '2026-10-28')).toBe('ATRASADO');
    expect(payableStatus({ dueDate: '2026-10-01', paidDate: '2026-10-30' }, '2026-10-28')).toBe('PAGO');
  });
  it('recebível: pendente, atrasado ou recebido', () => {
    expect(receivableStatus({ expectedDate: '2026-11-27', receivedDate: null }, '2026-10-28')).toBe('PENDENTE');
    expect(receivableStatus({ expectedDate: '2026-10-20', receivedDate: null }, '2026-10-28')).toBe('ATRASADO');
    expect(receivableStatus({ expectedDate: '2026-10-20', receivedDate: '2026-10-21' }, '2026-10-28')).toBe('RECEBIDO');
  });
});

describe('recorrência e prazo', () => {
  it('dia 31 volta ao dia 31 depois dos meses curtos', () => {
    expect(monthlyDates('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(monthlyDates('2026-11-05', 3)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
  });
  it('limita a quantidade', () => {
    expect(monthlyDates('2026-01-10', 500)).toHaveLength(36);
    expect(monthlyDates('2026-01-10', 0)).toHaveLength(1);
  });
  it('crédito D+30 e líquido da taxa', () => {
    expect(settlementDate('2026-10-28', 30)).toBe('2026-11-27');
    expect(settlementDate('2026-10-28', 0)).toBe('2026-10-28');
    expect(receivableNet(10000, 349)).toBe(9651);
    expect(receivableNet(100, 500)).toBe(0);
  });
});

describe('plano de contas', () => {
  it('tem despesas e receitas e acrescenta categorias do segmento', () => {
    const clinica = defaultChartOfAccounts('CLINICA_MEDICA');
    expect(clinica.some((c) => c.name === 'Convênios e repasses')).toBe(true);
    expect(clinica.filter((c) => c.type === 'RECEITA').length).toBeGreaterThan(0);
    expect(clinica[clinica.length - 4].name).toBe('Outras despesas');
    expect(new Set(clinica.map((c) => c.name)).size).toBe(clinica.length);
    expect(defaultChartOfAccounts('SALAO_BELEZA').some((c) => c.name === 'Produtos de cabelo e química')).toBe(true);
  });
});

describe('DRE gerencial', () => {
  const base = {
    salesGrossCents: 100_000,
    otherRevenueCents: 5_000,
    discountsCents: 10_000,
    feesCents: 3_000,
    commissionsCents: 30_000,
    expenses: [
      { categoryId: 'a', name: 'Aluguel', cents: 20_000 },
      { categoryId: 'b', name: 'Energia', cents: 5_000 },
      { categoryId: 'a', name: 'Aluguel', cents: 1_000 },
      { categoryId: null, name: 'Sem categoria', cents: 2_000 },
    ],
  };
  it('encadeia receita bruta → resultado', () => {
    const d = buildDre(base);
    expect(d.grossRevenueCents).toBe(105_000);
    expect(d.netRevenueCents).toBe(92_000);
    expect(d.contributionCents).toBe(62_000);
    expect(d.contributionBps).toBe(6739);
    expect(d.fixedExpensesCents).toBe(28_000);
    expect(d.resultCents).toBe(34_000);
    expect(d.resultBps).toBe(3696);
  });
  it('agrupa despesas por categoria, maiores primeiro', () => {
    const d = buildDre(base);
    expect(d.expensesByCategory.map((e) => [e.name, e.cents])).toEqual([
      ['Aluguel', 21_000],
      ['Energia', 5_000],
      ['Sem categoria', 2_000],
    ]);
  });
  it('resultado negativo e sem receita não divide por zero', () => {
    const d = buildDre({ salesGrossCents: 0, otherRevenueCents: 0, discountsCents: 0, feesCents: 0, commissionsCents: 0, expenses: [{ categoryId: 'a', name: 'Aluguel', cents: 500 }] });
    expect(d.resultCents).toBe(-500);
    expect(d.resultBps).toBe(0);
  });
});

describe('fluxo de caixa', () => {
  const inflows = [
    { date: '2026-10-26', cents: 10_000 },
    { date: '2026-10-28', cents: 5_000 },
    { date: '2026-11-03', cents: 7_000 },
    { date: '2026-12-01', cents: 999 }, // fora do período
  ];
  const outflows = [
    { date: '2026-10-28', cents: 2_000 },
    { date: '2026-11-02', cents: 4_000 },
  ];
  it('por dia, com saldo acumulado', () => {
    const f = buildCashFlow({ from: '2026-10-27', to: '2026-10-29', bucket: 'dia', inflows, outflows, openingCents: 1_000 });
    expect(f.buckets.map((b) => b.start)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
    expect(f.buckets[1]).toMatchObject({ inCents: 5_000, outCents: 2_000, netCents: 3_000, balanceCents: 4_000 });
    expect(f.inCents).toBe(5_000);
    expect(f.netCents).toBe(3_000);
  });
  it('por semana (segunda a domingo, cortada nas pontas)', () => {
    const f = buildCashFlow({ from: '2026-10-28', to: '2026-11-08', bucket: 'semana', inflows, outflows });
    expect(f.buckets.map((b) => [b.start, b.end])).toEqual([
      ['2026-10-28', '2026-11-01'],
      ['2026-11-02', '2026-11-08'],
    ]);
    expect(f.buckets[0]).toMatchObject({ inCents: 5_000, outCents: 2_000, balanceCents: 3_000 });
    expect(f.buckets[1]).toMatchObject({ inCents: 7_000, outCents: 4_000, balanceCents: 6_000 });
  });
  it('previsto vencido entra hoje', () => {
    expect(projectedDate('2026-10-01', '2026-10-28')).toBe('2026-10-28');
    expect(projectedDate('2026-11-01', '2026-10-28')).toBe('2026-11-01');
  });
});
