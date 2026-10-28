import { canDeleteRecord, cleanAnswers, defaultAnamnesis, validateAnswers, validateTemplate, type DocQuestion } from './clinical';
import { COMING_SOON_FEATURES, normalizeFeatures } from './segments';

const qs: DocQuestion[] = [
  { id: 'motivo', label: 'Motivo', type: 'TEXTO', required: true },
  { id: 'vacinas', label: 'Vacinas em dia?', type: 'SIM_NAO' },
  { id: 'sangue', label: 'Tipo sanguíneo', type: 'ESCOLHA', options: ['A', 'B', 'O'] },
];

describe('módulo clínico', () => {
  it('valida respostas: obrigatória, sim/não, opção e pergunta desconhecida', () => {
    expect(validateAnswers(qs, { motivo: 'Febre' })).toBeNull();
    expect(validateAnswers(qs, {})).toBe('Responda: Motivo');
    expect(validateAnswers(qs, { motivo: 'x', vacinas: 'talvez' })).toMatch(/sim ou não/);
    expect(validateAnswers(qs, { motivo: 'x', sangue: 'Z' })).toMatch(/opções/);
    expect(validateAnswers(qs, { motivo: 'x', invasora: 'y' })).toMatch(/não existem/);
    expect(validateAnswers(qs, { motivo: 'a'.repeat(1001) })).toMatch(/muito longa/);
  });

  it('limpa respostas: só as conhecidas, aparadas, sem vazios', () => {
    expect(cleanAnswers(qs, { motivo: '  Febre ', vacinas: '', outra: 'lixo' })).toEqual({ motivo: 'Febre' });
  });

  it('valida modelo de anamnese e de termo', () => {
    expect(validateTemplate({ kind: 'ANAMNESE', title: 'Ficha', questions: qs })).toBeNull();
    expect(validateTemplate({ kind: 'ANAMNESE', title: ' ', questions: qs })).toMatch(/nome/);
    expect(validateTemplate({ kind: 'ANAMNESE', title: 'F', questions: [] })).toMatch(/ao menos uma/);
    expect(validateTemplate({ kind: 'ANAMNESE', title: 'F', questions: [qs[0], qs[0]] })).toMatch(/repetidas/);
    expect(validateTemplate({ kind: 'ANAMNESE', title: 'F', questions: [{ id: 'a', label: 'Tipo', type: 'ESCOLHA', options: ['só uma'] }] })).toMatch(/2 opções/);
    expect(validateTemplate({ kind: 'TERMO', title: 'T', body: '' })).toMatch(/texto do termo/);
    expect(validateTemplate({ kind: 'TERMO', title: 'T', body: 'Concordo.' })).toBeNull();
  });

  it('anamnese-modelo vem por segmento e é válida', () => {
    for (const s of ['CLINICA_MEDICA', 'ODONTOLOGIA', 'ESTETICA', 'TERAPIAS'] as const) {
      const d = defaultAnamnesis(s);
      expect(validateTemplate({ kind: 'ANAMNESE', title: d.title, questions: d.questions })).toBeNull();
    }
  });

  it('o autor apaga só dentro de 24 h', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(canDeleteRecord('2026-11-10T01:00:00Z', 'm1', 'm1', now)).toBe(true);
    expect(canDeleteRecord('2026-11-09T11:59:00Z', 'm1', 'm1', now)).toBe(false);
    expect(canDeleteRecord('2026-11-10T01:00:00Z', 'm1', 'm2', now)).toBe(false);
  });

  it('módulos sem tela não podem ser ligados', () => {
    expect(normalizeFeatures(['PRONTUARIO', 'FOTOS', 'TELECONSULTA', 'ANAMNESE'])).toEqual(['ANAMNESE', 'PRONTUARIO']);
    expect(COMING_SOON_FEATURES).toEqual(expect.arrayContaining(['SALAS', 'CONVENIOS']));
  });
});
