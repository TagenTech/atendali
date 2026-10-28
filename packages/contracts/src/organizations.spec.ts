import { defaultBusinessHours, describeDay, effectiveHours, validateBusinessHours } from './business-hours';
import { FEATURES, normalizeFeatures, SEGMENT_PRESETS, SEGMENTS } from './segments';
import { initials } from './organizations';
import { isValidSlug, slugify } from './slug';

describe('segmentos', () => {
  it('todo segmento tem vocabulário, serviços-modelo válidos e só módulos conhecidos', () => {
    for (const s of SEGMENTS) {
      const p = SEGMENT_PRESETS[s];
      expect(p.vocabulary.client).toBeTruthy();
      expect(p.sampleServices.length).toBeGreaterThan(0);
      for (const svc of p.sampleServices) {
        expect(svc.durationMinutes).toBeGreaterThanOrEqual(5);
        expect(Number.isInteger(svc.priceCents)).toBe(true);
      }
      for (const f of p.features) expect(FEATURES).toContain(f);
    }
  });

  it('saúde usa "Paciente"; beleza usa "Cliente"', () => {
    expect(SEGMENT_PRESETS.CLINICA_MEDICA.vocabulary.client).toBe('Paciente');
    expect(SEGMENT_PRESETS.SALAO_BELEZA.vocabulary.client).toBe('Cliente');
  });

  it('normalizeFeatures remove desconhecidos e repetidos e ordena', () => {
    expect(normalizeFeatures(['PRONTUARIO', 'xyz', 'COMISSOES', 'PRONTUARIO'])).toEqual(['COMISSOES', 'PRONTUARIO']);
  });
});

describe('horário de funcionamento', () => {
  it('o padrão é válido', () => {
    expect(validateBusinessHours(defaultBusinessHours())).toBeNull();
  });

  it('recusa formatos e faixas inválidas', () => {
    const h = defaultBusinessHours();
    expect(validateBusinessHours(h.slice(0, 6))).toMatch(/7 dias/);
    h[1] = [{ start: '10:00', end: '09:00' }];
    expect(validateBusinessHours(h)).toMatch(/Segunda: o fim/);
    h[1] = [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '18:00' }];
    expect(validateBusinessHours(h)).toMatch(/sobrepostas/);
    h[1] = [{ start: '9:00', end: '13:00' }];
    expect(validateBusinessHours(h)).toMatch(/inválido/);
  });

  it('aceita almoço (duas faixas)', () => {
    const h = defaultBusinessHours();
    h[2] = [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }];
    expect(validateBusinessHours(h)).toBeNull();
    expect(describeDay(h[2])).toBe('08:00–12:00, 13:00–18:00');
    expect(describeDay([])).toBe('Fechado');
  });
});

describe('horário efetivo do profissional', () => {
  it('sem horário próprio vale o da unidade', () => {
    const unit = defaultBusinessHours();
    expect(effectiveHours(unit, null)).toBe(unit);
  });

  it('interseção com a unidade, inclusive com almoço', () => {
    const unit = defaultBusinessHours(); // seg–sex 9–19, sáb 9–14
    const pro = defaultBusinessHours().map(() => [] as { start: string; end: string }[]);
    pro[1] = [{ start: '07:00', end: '12:00' }, { start: '14:00', end: '21:00' }];
    pro[0] = [{ start: '10:00', end: '12:00' }]; // domingo: a unidade está fechada
    const eff = effectiveHours(unit, pro);
    expect(eff[1]).toEqual([{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }]);
    expect(eff[0]).toEqual([]);
    expect(eff[2]).toEqual([]);
  });
});

describe('initials', () => {
  it('primeira e última inicial', () => {
    expect(initials('Ana Paula Souza')).toBe('AS');
    expect(initials(' bela ')).toBe('B');
  });
});

describe('slug', () => {
  it('slugify tira acentos, símbolos e espaços', () => {
    expect(slugify('Studio Bella & Cia.')).toBe('studio-bella-e-cia');
    expect(slugify('  Clínica São João  ')).toBe('clinica-sao-joao');
  });

  it('isValidSlug', () => {
    expect(isValidSlug('studio-bella')).toBe(true);
    expect(isValidSlug('login')).toBe(false);
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('-abc')).toBe(false);
    expect(isValidSlug('ab--c')).toBe(false);
  });
});
