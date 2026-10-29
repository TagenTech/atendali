import {
  canDeleteRecord,
  cleanAnswers,
  composeCertificateBody,
  composeRecordContent,
  defaultAnamnesis,
  emptyRxLine,
  formatRxLine,
  formatVitals,
  numberedRx,
  parseRecordSections,
  recordDraftErrors,
  recordFields,
  suggestedRecordTitle,
  validateAnswers,
  validateTemplate,
  type DocQuestion,
  type RxLine,
} from './clinical';
import { COMING_SOON_FEATURES, normalizeFeatures, SEGMENTS } from './segments';

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

  it('a evolução muda com o segmento e a receita/atestado são iguais', () => {
    expect(recordFields('EVOLUCAO', 'CLINICA_MEDICA').map((f) => f.id)).toEqual(
      expect.arrayContaining(['queixa', 'exame', 'pa', 'avaliacao', 'conduta']),
    );
    expect(recordFields('EVOLUCAO', 'ODONTOLOGIA').some((f) => f.id === 'dente')).toBe(true);
    expect(recordFields('EVOLUCAO', 'ESTETICA').some((f) => f.id === 'area')).toBe(true);
    expect(recordFields('EVOLUCAO', 'TERAPIAS').some((f) => f.id === 'sessao')).toBe(true);
    expect(recordFields('EVOLUCAO', 'SALAO_BELEZA').some((f) => f.id === 'observacao')).toBe(true);
    expect(recordFields('PRESCRICAO', 'CLINICA_MEDICA').map((f) => f.id)).toEqual(['continuo', 'orientacao']);
    expect(recordFields('ATESTADO', 'ODONTOLOGIA').map((f) => f.id)).toEqual(['dias', 'cid', 'observacao']);
    expect(suggestedRecordTitle('EVOLUCAO', 'CLINICA_MEDICA')).toBe('Consulta');
    expect(suggestedRecordTitle('EVOLUCAO', 'ESTETICA')).toBe('Sessão');
    expect(suggestedRecordTitle('PRESCRICAO', 'TERAPIAS')).toBe('Receituário');
    expect(suggestedRecordTitle('ATESTADO', 'OUTRO')).toBe('Atestado');
    expect(suggestedRecordTitle('EVOLUCAO', 'OUTRO')).toBe('Atendimento');
  });

  it('monta e lê de volta uma evolução clínica com sinais', () => {
    const values = { queixa: 'Febre há 2 dias', exame: 'Orofaringe hiperemiada', pa: '120/80', fc: '88', temp: '37,8', avaliacao: 'IVAS', conduta: 'Hidratação' };
    const content = composeRecordContent({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values });
    expect(content).toContain('### Queixa\nFebre há 2 dias');
    expect(content).toContain('### Sinais\nPA 120/80 · FC 88 · Temp 37,8 °C');
    expect(parseRecordSections(content).map((s) => s.label)).toEqual(['Queixa', 'Exame', 'Sinais', 'Avaliação', 'Conduta']);
    expect(recordDraftErrors({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values })).toEqual({});
  });

  it('receita numera só as linhas com medicamento; atestado flexiona o dia', () => {
    const rx: RxLine[] = [
      { name: 'Dipirona 500 mg', dose: '1 cp', schedule: '6/6 h', duration: '3 dias' },
      emptyRxLine(),
      { name: 'Soro nasal', dose: '', schedule: '', duration: '' },
    ];
    expect(formatRxLine(emptyRxLine())).toBeNull();
    expect(numberedRx(rx)).toBe('1. Dipirona 500 mg — 1 cp 6/6 h por 3 dias\n2. Soro nasal');
    const receita = composeRecordContent({ kind: 'PRESCRICAO', segment: 'CLINICA_MEDICA', values: { continuo: 'Não', orientacao: 'Se piorar, retornar.' }, rx });
    expect(receita).toContain('### Medicamentos');
    expect(receita).toContain('### Uso contínuo\nNão');
    expect(composeCertificateBody(1)).toContain('1 dia de afastamento');
    expect(composeCertificateBody(2, 'Sofia Costa')).toContain('que Sofia Costa esteve');
    expect(composeCertificateBody(2, 'Sofia Costa')).toContain('2 dias');
    const atestado = composeRecordContent({
      kind: 'ATESTADO',
      segment: 'CLINICA_MEDICA',
      values: { dias: '2', cid: 'J06.9', observacao: 'Repouso' },
      patientName: 'Sofia Costa',
    });
    expect(atestado).toContain('Sofia Costa');
    expect(atestado).toContain('### CID\nJ06.9');
    expect(parseRecordSections(atestado)[0].label).toBe('Atestado');
  });

  it('rascunho vazio, dias inválidos e texto livre antigo', () => {
    expect(recordDraftErrors({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values: {} })).toEqual({ queixa: 'Escreva a anotação' });
    expect(recordDraftErrors({ kind: 'PRESCRICAO', segment: 'CLINICA_MEDICA', values: {}, rx: [emptyRxLine()] })).toEqual({
      rx: 'Inclua ao menos um medicamento',
    });
    expect(recordDraftErrors({ kind: 'ATESTADO', segment: 'CLINICA_MEDICA', values: { dias: '0' } })).toEqual({
      dias: 'Informe os dias de afastamento',
    });
    expect(recordDraftErrors({ kind: 'ATESTADO', segment: 'CLINICA_MEDICA', values: { dias: '1.5' } }).dias).toBeDefined();
    expect(formatVitals({})).toBeNull();
    expect(parseRecordSections('')).toEqual([]);
    expect(parseRecordSections('Febre há 2 dias. Orientado repouso.')).toEqual([
      { label: 'Notas', value: 'Febre há 2 dias. Orientado repouso.' },
    ]);
    expect(composeRecordContent({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values: { queixa: '### injecção' } })).toContain('injecção');
    expect(composeRecordContent({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values: { queixa: '### injecção' } })).not.toMatch(/^### Queixa\n### /);
  });

  it('cobertura: todo segmento × tipo gera texto válido quando o rascunho está preenchido', () => {
    for (const segment of SEGMENTS) {
      for (const kind of ['EVOLUCAO', 'PRESCRICAO', 'ATESTADO'] as const) {
        const values: Record<string, string> = {};
        for (const f of recordFields(kind, segment)) {
          values[f.id] = f.type === 'number' ? '2' : (f.options?.[0] ?? 'ok');
        }
        const rx = [{ name: 'Dipirona', dose: '1 cp', schedule: '8/8 h', duration: '2 dias' }];
        const content = composeRecordContent({ kind, segment, values, rx, patientName: 'Ana' });
        expect(content.length).toBeGreaterThan(0);
        expect(recordDraftErrors({ kind, segment, values, rx, patientName: 'Ana' })).toEqual({});
        expect(parseRecordSections(content).length).toBeGreaterThan(0);
      }
    }
  });
});
