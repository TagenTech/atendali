import {
  addMonthsFrom,
  cycleEnd,
  currentCycle,
  formatRating,
  generateGiftCode,
  giftCardStatus,
  loyaltyOf,
  membershipCanUse,
  membershipState,
  normalizeGiftCode,
  packageExpiry,
  packageStatus,
  pointsEarned,
  publicName,
  ratingSummary,
  redeemable,
  renewMembership,
  sessionValueCents,
  sessionsLeft,
  validateLoyalty,
} from './retention';

describe('pacotes de sessões', () => {
  it('saldo e status: esgotado vence vencido', () => {
    expect(sessionsLeft({ sessionsTotal: 10, sessionsUsed: 3 })).toBe(7);
    expect(sessionsLeft({ sessionsTotal: 10, sessionsUsed: 12 })).toBe(0);
    const base = { sessionsTotal: 5, sessionsUsed: 2, expiresAt: '2026-12-31' };
    expect(packageStatus(base, '2026-12-31')).toBe('ATIVO');
    expect(packageStatus(base, '2027-01-01')).toBe('EXPIRADO');
    expect(packageStatus({ ...base, sessionsUsed: 5 }, '2027-06-01')).toBe('ESGOTADO');
    expect(packageStatus({ ...base, expiresAt: null }, '2030-01-01')).toBe('ATIVO');
  });

  it('validade e valor por sessão', () => {
    expect(packageExpiry('2026-11-01', 90)).toBe('2027-01-30');
    expect(packageExpiry('2026-11-01', null)).toBeNull();
    expect(sessionValueCents(100_000, 10)).toBe(10_000);
    expect(sessionValueCents(10_000, 3)).toBe(3333);
    expect(sessionValueCents(500, 0)).toBe(0);
  });
});

describe('clube: ciclos a partir da âncora', () => {
  it('meses curtos não deslocam o dia (31/jan → 28/fev → 31/mar)', () => {
    expect(addMonthsFrom('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsFrom('2026-01-31', 2)).toBe('2026-03-31');
    expect(cycleEnd('2026-01-31', 1)).toBe('2026-02-27');
    expect(cycleEnd('2026-01-31', 2)).toBe('2026-03-30');
  });

  it('ciclo que contém hoje', () => {
    expect(currentCycle('2026-10-15', '2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-11-14', index: 0 });
    expect(currentCycle('2026-10-15', '2026-11-14')).toEqual({ start: '2026-10-15', end: '2026-11-14', index: 0 });
    expect(currentCycle('2026-10-15', '2026-11-15')).toEqual({ start: '2026-11-15', end: '2026-12-14', index: 1 });
  });

  it('situação: em dia até o último dia pago; pausada e cancelada mandam', () => {
    expect(membershipState({ status: 'ATIVA', paidThrough: '2026-11-14' }, '2026-11-14')).toBe('EM_DIA');
    expect(membershipState({ status: 'ATIVA', paidThrough: '2026-11-14' }, '2026-11-15')).toBe('VENCIDA');
    expect(membershipState({ status: 'ATIVA', paidThrough: null }, '2026-11-01')).toBe('VENCIDA');
    expect(membershipState({ status: 'PAUSADA', paidThrough: '2030-01-01' }, '2026-11-01')).toBe('PAUSADA');
    expect(membershipState({ status: 'CANCELADA', paidThrough: '2030-01-01' }, '2026-11-01')).toBe('CANCELADA');
  });

  it('uso: ilimitado ou até o limite do ciclo', () => {
    expect(membershipCanUse('EM_DIA', null, 99)).toBe(true);
    expect(membershipCanUse('EM_DIA', 4, 3)).toBe(true);
    expect(membershipCanUse('EM_DIA', 4, 4)).toBe(false);
    expect(membershipCanUse('VENCIDA', null, 0)).toBe(false);
  });

  it('renovação: primeira/vencida recomeça hoje; em dia só perto do vencimento', () => {
    expect(renewMembership({ anchor: null, cyclesPaid: 0, paidThrough: null }, '2026-10-20')).toEqual({
      anchor: '2026-10-20',
      cyclesPaid: 1,
      paidThrough: '2026-11-19',
    });
    // Vencida: recomeça a contagem.
    expect(renewMembership({ anchor: '2026-08-01', cyclesPaid: 2, paidThrough: '2026-09-30' }, '2026-10-20')).toEqual({
      anchor: '2026-10-20',
      cyclesPaid: 1,
      paidThrough: '2026-11-19',
    });
    // Em dia, longe do vencimento: não renova.
    expect(renewMembership({ anchor: '2026-10-20', cyclesPaid: 1, paidThrough: '2026-11-19' }, '2026-10-25')).toBeNull();
    // Em dia, perto do vencimento: acrescenta um ciclo.
    expect(renewMembership({ anchor: '2026-10-20', cyclesPaid: 1, paidThrough: '2026-11-19' }, '2026-11-12')).toEqual({
      anchor: '2026-10-20',
      cyclesPaid: 2,
      paidThrough: '2026-12-19',
    });
  });
});

describe('vale-presente', () => {
  it('gera código XXXX-XXXX-XXXX sem caracteres ambíguos', () => {
    let n = 0;
    const code = generateGiftCode(() => n++ % 31);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('normaliza o que a pessoa digita', () => {
    expect(normalizeGiftCode('abcd efgh jkmn')).toBe('ABCD-EFGH-JKMN');
    expect(normalizeGiftCode('ABCD-EFGH-JKMN')).toBe('ABCD-EFGH-JKMN');
    expect(normalizeGiftCode('abc')).toBeNull();
    expect(normalizeGiftCode('ABCD-EFGH-JKMN-X')).toBeNull();
  });

  it('status: sem saldo = usado; passou da validade = vencido', () => {
    expect(giftCardStatus({ balanceCents: 5000, expiresAt: '2026-12-31' }, '2026-12-31')).toBe('ATIVO');
    expect(giftCardStatus({ balanceCents: 5000, expiresAt: '2026-12-31' }, '2027-01-01')).toBe('EXPIRADO');
    expect(giftCardStatus({ balanceCents: 0, expiresAt: '2026-12-31' }, '2026-11-01')).toBe('USADO');
  });
});

describe('fidelidade', () => {
  const rule = loyaltyOf({ enabled: true, pointsPerReal: 2, redeemPoints: 100, redeemValueCents: 1000 });

  it('pontos por valor pago, sem contar fração de real', () => {
    expect(pointsEarned(15_000, rule)).toBe(300);
    expect(pointsEarned(1_999, rule)).toBe(39);
    expect(pointsEarned(0, rule)).toBe(0);
    expect(pointsEarned(-500, rule)).toBe(0);
  });

  it('resgate em múltiplos, limitado pelo saldo e pelo valor da conta', () => {
    expect(redeemable(250, rule, 50_000)).toEqual({ points: 200, discountCents: 2000 });
    expect(redeemable(1000, rule, 2500)).toEqual({ points: 200, discountCents: 2000 });
    expect(redeemable(99, rule, 50_000)).toEqual({ points: 0, discountCents: 0 });
    expect(redeemable(1000, rule, 0)).toEqual({ points: 0, discountCents: 0 });
  });

  it('regra padrão vem desligada e é validada', () => {
    expect(loyaltyOf(null).enabled).toBe(false);
    expect(validateLoyalty(rule)).toBeNull();
    expect(validateLoyalty({ ...rule, redeemValueCents: 0 })).toMatch(/maior que zero/);
    expect(validateLoyalty({ ...rule, pointsPerReal: 0 })).toMatch(/Pontos por real/);
  });
});

describe('avaliações e nomes públicos', () => {
  it('média com uma casa, ignorando notas inválidas', () => {
    expect(ratingSummary([5, 4, 5, 5])).toEqual({ count: 4, averageTimes10: 48 });
    expect(ratingSummary([5, 0, 9, 3.5])).toEqual({ count: 1, averageTimes10: 50 });
    expect(ratingSummary([])).toEqual({ count: 0, averageTimes10: 0 });
    expect(formatRating(47)).toBe('4,7');
  });

  it('nome público: primeiro nome + inicial do último', () => {
    expect(publicName('Ana Paula Souza')).toBe('Ana S.');
    expect(publicName('  maria  ')).toBe('maria');
    expect(publicName('')).toBe('');
  });
});
