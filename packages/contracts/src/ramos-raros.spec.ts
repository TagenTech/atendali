/**
 * Ramos pouco visitados das regras puras (entradas vazias, valores-limite, textos prontos).
 * Cada bloco aponta para a regra que protege; existe para manter a cobertura de `contracts` acima da meta (90%).
 */
import { permissionsOf, ROLE_PERMISSIONS, can } from './access';
import { availableSlots, canClientCancel, withinBusinessHours, confirmationMessage } from './agenda';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABEL, AUDIT_GROUPS, AUDIT_GROUP_KEYS } from './audit';
import { deviceLabel } from './auth';
import { validateBusinessHours, effectiveHours } from './business-hours';
import {
  canDeleteRecord,
  cleanAnswers,
  composeRecordContent,
  defaultAnamnesis,
  defaultTerm,
  documentMessage,
  formatRxLine,
  formatVitals,
  parseRecordSections,
  RECORD_CONTENT_MAX,
  RECORD_KIND_HINT,
  RECORD_SHEET_TITLE,
  recordDraftErrors,
  recordFields,
  suggestedRecordTitle,
  validateAnswers,
  validateTemplate,
} from './clinical';
import { formatCpf, maskCpf } from './cpf';
import { parseCsv, previewClientImport } from './csv';
import { formatDateLong, formatDateShort, todayIn } from './dates';
import { orderTotals, paymentMethodsOf, pct } from './finance';
import { ageLabel, isGuardianRelationship } from './guardian';
import { defaultChartOfAccounts } from './ledger';
import { parseBRL } from './money';
import { initials } from './organizations';
import { formatPhone } from './phone';
import { isCommonPassword, passwordProblem } from './password';
import { safeNext } from './redirect';
import { dueReminder } from './reminders';
import { birthdayMessage, buildOverview, comebackMessage, upcomingBirthdays, workingMinutes } from './reports';
import { validateLoyalty } from './retention';
import { SEGMENTS, vocabularyFor, SEGMENT_PRESETS } from './segments';
import { abcClasses } from './stock';
import { dayOfMonth, formatDuration, isHHmm, lastDayOf, monthLabel, firstDayOf, WEEKDAYS, WEEKDAYS_SHORT } from './time';

describe('access', () => {
  it('permissionsOf devolve uma cópia da tabela do perfil', () => {
    const list = permissionsOf('DONO');
    expect(list).toEqual(ROLE_PERMISSIONS.DONO);
    list.pop();
    expect(permissionsOf('DONO')).toEqual(ROLE_PERMISSIONS.DONO);
    expect(can('DONO', list[0])).toBe(true);
  });
});

describe('agenda: ramos raros', () => {
  const hours = [[], [{ start: '09:00', end: '10:00' }], [], [], [], [], []];

  it('dia sem expediente não tem horário', () => {
    // 2026-11-01 é domingo (sem faixas); a lista vazia cobre o `?? []` do dia.
    expect(availableSlots({ date: '2026-11-01', hours, durationMinutes: 30, busy: [], timezone: 'America/Sao_Paulo' })).toEqual([]);
    expect(availableSlots({ date: '2026-11-01', hours: [] as never, durationMinutes: 30, busy: [], timezone: 'America/Sao_Paulo' })).toEqual([]);
  });

  it('withinBusinessHours recusa o que atravessa a meia-noite e dia sem faixas', () => {
    const tz = 'America/Sao_Paulo';
    expect(withinBusinessHours(new Date('2026-11-02T02:30:00Z'), new Date('2026-11-02T04:30:00Z'), hours, tz)).toBe(false);
    expect(withinBusinessHours(new Date('2026-11-01T12:00:00Z'), new Date('2026-11-01T12:30:00Z'), hours, tz)).toBe(false);
    expect(withinBusinessHours(new Date('2026-11-02T12:00:00Z'), new Date('2026-11-02T12:30:00Z'), hours, tz)).toBe(true);
    expect(withinBusinessHours(new Date('2026-11-02T12:00:00Z'), new Date('2026-11-02T12:30:00Z'), [] as never, tz)).toBe(false);
  });

  it('confirmação sem preço não escreve valor', () => {
    const base = { startsAt: '2026-11-02T12:00:00Z', timezone: 'America/Sao_Paulo', clientName: 'Ana Souza', organizationName: 'Clínica', serviceName: 'Consulta', professionalName: 'Dra. Bia' };
    const sem = (confirmationMessage as (a: object) => string)({ ...base, priceCents: 0 });
    const com = (confirmationMessage as (a: object) => string)({ ...base, priceCents: 15000 });
    expect(sem).not.toContain('R$');
    expect(com).toContain('R$');
    expect(sem).toContain('Ana');
  });

  it('canClientCancel usa o relógio real quando não recebe "agora"', () => {
    const longe = new Date(Date.now() + 5 * 24 * 3_600_000).toISOString();
    expect(canClientCancel('AGENDADO', longe)).toBe(true);
    expect(canClientCancel('CONCLUIDO', longe)).toBe(false);
  });
});

describe('audit', () => {
  it('toda ação tem rótulo e pertence a exatamente um grupo', () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(0);
    const grouped = AUDIT_GROUP_KEYS.flatMap((k) => [...AUDIT_GROUPS[k].actions]);
    for (const action of AUDIT_ACTIONS) {
      expect(AUDIT_ACTION_LABEL[action]).toBeTruthy();
      expect(grouped.filter((g) => g === action)).toHaveLength(1);
    }
    expect(grouped).toHaveLength(AUDIT_ACTIONS.length);
  });
});

describe('auth.deviceLabel', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604', 'iPhone'],
    ['Mozilla/5.0 (iPad; CPU OS 17) Safari/604', 'iPad'],
    ['Mozilla/5.0 (Linux; Android 14) Chrome/120', 'Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Safari/605', 'Mac'],
    ['Mozilla/5.0 (Windows NT 10.0) Edg/120', 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) Firefox/121', 'Linux'],
    ['curl/8.0', 'Aparelho'],
  ])('%s → começa com %s', (ua, os) => {
    expect(deviceLabel(ua).startsWith(os)).toBe(true);
  });
  it.each([
    ['Windows NT Edg/120', 'Edge'],
    ['Windows NT OPR/100', 'Opera'],
    ['X11; Linux Firefox/121', 'Firefox'],
    ['Windows NT Chrome/120', 'Chrome'],
    ['Macintosh Safari/605', 'Safari'],
  ])('%s → termina com %s', (ua, browser) => {
    expect(deviceLabel(ua).endsWith(browser)).toBe(true);
  });
  it('sem User-Agent', () => {
    expect(deviceLabel(null)).toContain('Aparelho');
    expect(deviceLabel(undefined)).toContain('Aparelho');
  });
});

describe('business-hours', () => {
  const ok = (): { start: string; end: string }[][] => [[], [{ start: '09:00', end: '18:00' }], [], [], [], [], []];

  it('valida o formato da semana', () => {
    expect(validateBusinessHours(null)).toMatch(/7 dias/);
    expect(validateBusinessHours([[], []])).toMatch(/7 dias/);
    const muitas = ok();
    muitas[1] = Array.from({ length: 5 }, () => ({ start: '09:00', end: '10:00' }));
    expect(validateBusinessHours(muitas)).toMatch(/até 4 faixas/);
    const naoLista = ok() as unknown[];
    naoLista[2] = 'x';
    expect(validateBusinessHours(naoLista)).toMatch(/até 4 faixas/);
    expect(validateBusinessHours(ok())).toBeNull();
  });

  it('horário efetivo: sem faixa do profissional, sem horário', () => {
    const unit = ok();
    expect(effectiveHours(unit, null)).toEqual(unit);
    expect(effectiveHours(unit, [[], [], [], [], [], [], []] as never)[1]).toEqual([]);
    expect(effectiveHours(unit, [] as never)[1]).toEqual([]);
    expect(effectiveHours(unit, ok())[1]).toEqual([{ start: '09:00', end: '18:00' }]);
  });
});

describe('clinical: ramos raros', () => {
  const sim = { id: 'a', label: 'Fuma?', type: 'SIM_NAO' as const };
  const esc = { id: 'b', label: 'Tipo', type: 'ESCOLHA' as const, options: ['A', 'B'] };

  it('apagar anotação: só o autor, até 24 h (relógio real por padrão)', () => {
    const agora = new Date().toISOString();
    expect(canDeleteRecord(agora, 'm1', 'm1')).toBe(true);
    expect(canDeleteRecord(agora, 'm1', 'm2')).toBe(false);
    expect(canDeleteRecord('2020-01-01T00:00:00Z', 'm1', 'm1')).toBe(false);
  });

  it('respostas: sem respostas, opcionais vazias, resposta inválida e pergunta desconhecida', () => {
    expect(validateAnswers([{ id: 'x', label: 'Algo', type: 'TEXTO' }], undefined)).toBeNull();
    expect(validateAnswers([{ id: 'x', label: 'Algo', type: 'TEXTO', required: true }], undefined)).toMatch(/Responda/);
    expect(validateAnswers([sim], { a: 'TALVEZ' })).toMatch(/sim ou não/);
    expect(validateAnswers([esc], { b: 'Z' })).toMatch(/opções/);
    expect(validateAnswers([{ id: 'c', label: 'Escolha', type: 'ESCOLHA' }], { c: 'Z' })).toMatch(/opções/);
    expect(validateAnswers([sim], { a: 'SIM', zzz: 'x' })).toMatch(/não existem/);
    expect(validateAnswers([sim, esc], { a: 'NAO', b: 'A' })).toBeNull();
  });

  it('cleanAnswers aceita ausência de respostas', () => {
    expect(cleanAnswers([sim], undefined)).toEqual({});
    expect(cleanAnswers([sim], { a: ' SIM ', fora: 'x' })).toEqual({ a: 'SIM' });
  });

  it('valida o modelo: termo e ficha', () => {
    expect(validateTemplate({ title: ' ', kind: 'TERMO', body: 'x' })).toMatch(/nome/);
    expect(validateTemplate({ title: 'T', kind: 'TERMO', body: ' ' })).toMatch(/texto do termo/);
    expect(validateTemplate({ title: 'T', kind: 'TERMO' })).toMatch(/texto do termo/);
    expect(validateTemplate({ title: 'T', kind: 'TERMO', body: 'x'.repeat(100_000) })).toMatch(/passa de/);
    expect(validateTemplate({ title: 'T', kind: 'TERMO', body: 'ok' })).toBeNull();
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE' })).toMatch(/ao menos uma pergunta/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: Array.from({ length: 200 }, (_, i) => ({ id: `q${i}`, label: 'x', type: 'TEXTO' as const })) })).toMatch(/No máximo/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: [sim, sim] })).toMatch(/repetidas/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: [{ ...sim, label: ' ' }] })).toMatch(/texto/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: [{ ...esc, options: ['A', ' '] }] })).toMatch(/2 opções/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: [{ id: 'e', label: 'E', type: 'ESCOLHA' }] })).toMatch(/2 opções/);
    expect(validateTemplate({ title: 'F', kind: 'ANAMNESE', questions: [sim, esc] })).toBeNull();
  });

  it('textos prontos', () => {
    expect(defaultTerm('Clínica Sol').body).toContain('Clínica Sol');
    expect(defaultTerm('X').title).toBe('Termo de consentimento');
    const msg = documentMessage({ patientFirstName: 'Bia', orgName: 'Clínica Sol', title: 'Ficha', link: 'https://x/y' });
    expect(msg).toContain('Bia');
    expect(msg).toContain('https://x/y');
    for (const seg of SEGMENTS) expect(defaultAnamnesis(seg).questions.length).toBeGreaterThan(0);
  });

  it('prontuário: títulos, sinais incompletos, seção sem corpo e teto do texto', () => {
    expect(suggestedRecordTitle('EVOLUCAO', 'ODONTOLOGIA')).toBe('Atendimento odontológico');
    expect(suggestedRecordTitle('EVOLUCAO', 'TERAPIAS')).toBe('Sessão');
    expect(suggestedRecordTitle('EVOLUCAO', 'BARBEARIA')).toBe('Atendimento');
    expect(RECORD_SHEET_TITLE.EVOLUCAO).toMatch(/evolução/);
    expect(RECORD_KIND_HINT.ATESTADO).toMatch(/papel/);
    expect(formatRxLine({ name: 'Dipirona', dose: '', schedule: '', duration: '' })).toBe('Dipirona');
    expect(formatVitals({ peso: '72', altura: '165' })).toBe('Peso 72 kg · Altura 165 cm');
    expect(parseRecordSections('### Só o título')).toEqual([{ label: 'Só o título', value: '' }]);
    expect(recordFields('EVOLUCAO', 'BARBEARIA').some((f) => f.id === 'observacao')).toBe(true);
    expect(recordDraftErrors({ kind: 'ATESTADO', segment: 'CLINICA_MEDICA', values: { dias: '400' } }).dias).toBeDefined();
    expect(recordDraftErrors({ kind: 'ATESTADO', segment: 'CLINICA_MEDICA', values: { dias: '' } }).dias).toBeDefined();
    const longo = { queixa: 'x'.repeat(RECORD_CONTENT_MAX) };
    expect(recordDraftErrors({ kind: 'EVOLUCAO', segment: 'CLINICA_MEDICA', values: longo }).content).toMatch(/No máximo/);
    expect(composeRecordContent({ kind: 'PRESCRICAO', segment: 'CLINICA_MEDICA', values: { orientacao: 'água' }, rx: [] })).toContain('### Orientação');
  });
});

describe('cpf e telefone: máscaras', () => {
  it('formata o CPF aos poucos e mascara só quando completo', () => {
    expect(formatCpf('12')).toBe('12');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
    expect(maskCpf('12345678909')).toBe('***.456.789-**');
    expect(maskCpf('123')).toBe('');
  });
  it('formata o telefone aos poucos', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('1')).toBe('(1');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('11987')).toBe('(11) 987');
    expect(formatPhone('119876543')).toBe('(11) 9876-543');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });
});

describe('csv: ramos raros', () => {
  const vazio = { people: [], emails: [] };
  it('aspas não contam como separador e a quebra de linha encerra a detecção', () => {
    expect(parseCsv('"a;b",c\n1,2')).toEqual([['a;b', 'c'], ['1', '2']]);
    expect(parseCsv('nome;celular\r\nAna;11987654321')[1]).toEqual(['Ana', '11987654321']);
  });
  it('recusa arquivo grande, sem linhas e sem coluna de nome', () => {
    expect(previewClientImport('x'.repeat(2_000_000), vazio).fatal).toMatch(/grande demais/);
    expect(previewClientImport('nome', vazio).fatal).toMatch(/Não encontrei linhas/);
    expect(previewClientImport('celular\n11987654321', vazio).fatal).toMatch(/coluna "Nome"/);
  });
  it('aponta cada tipo de erro por linha', () => {
    const csv = [
      'nome,celular,email,nascimento,observacoes',
      ',11987654321,,,',
      `${'x'.repeat(121)},,,,`,
      'Ana,123,,,',
      'Bia,,sem-arroba,,',
      'Cris,,,31/02/2020,',
      `Dani,,,,${'x'.repeat(2001)}`,
    ].join('\n');
    const reasons = previewClientImport(csv, vazio).rows.map((r) => r.reason);
    expect(reasons).toEqual([
      'Falta o nome',
      'Nome com mais de 120 letras',
      expect.stringMatching(/Celular inválido/),
      'E-mail inválido',
      expect.stringMatching(/Nascimento inválido/),
      expect.stringMatching(/Observações/),
    ]);
  });
});

describe('datas, dinheiro e horas', () => {
  it('todayIn usa o fuso padrão e o "agora" real quando omitidos', () => {
    expect(todayIn()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIn('America/Sao_Paulo', new Date('2026-03-05T01:00:00Z'))).toBe('2026-03-04');
  });
  it('datas por extenso', () => {
    expect(formatDateLong('2026-03-05')).toBe('5 de março de 2026');
    expect(formatDateLong('2026-03-05', false)).toBe('5 de março');
    expect(formatDateShort('2026-03-05', false)).not.toContain('2026');
  });
  it('parseBRL recusa o que não é número', () => {
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('1-2-3')).toBeNull();
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('12.5')).toBe(1250);
  });
  it('horas e meses', () => {
    expect(isHHmm('09:30')).toBe(true);
    expect(isHHmm(930)).toBe(false);
    expect(isHHmm('24:00')).toBe(false);
    expect(firstDayOf('2026-02')).toBe('2026-02-01');
    expect(lastDayOf('2026-02')).toBe('2026-02-28');
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
    expect(dayOfMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dayOfMonth('2026-02', 5)).toBe('2026-02-05');
    expect(monthLabel('2026-10')).toBe('outubro de 2026');
    expect(monthLabel('2026-10', false)).toBe('outubro');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h30');
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS_SHORT).toHaveLength(7);
  });
});

describe('finance, guardian, ledger e organizations', () => {
  it('formas de pagamento sem configuração salva usam o padrão', () => {
    expect(paymentMethodsOf(null)).toEqual(paymentMethodsOf(undefined));
    expect(paymentMethodsOf([]).length).toBeGreaterThan(0);
    expect(pct(250)).toMatch(/2,5/);
  });
  it('comanda vazia, sem pagamentos informados', () => {
    const t = orderTotals([], 0);
    expect(t.itemNetCents).toEqual([]);
  });
  it('parentesco e idade', () => {
    expect(isGuardianRelationship('MAE')).toBe(true);
    expect(isGuardianRelationship('vizinho')).toBe(false);
    expect(isGuardianRelationship(7)).toBe(false);
    expect(ageLabel(null, '2026-10-28')).toBeNull();
    expect(ageLabel('2030-01-01', '2026-10-28')).toBeNull();
    expect(ageLabel('2026-10-28', '2026-10-28')).toBe('0 mês');
    expect(ageLabel('2026-09-10', '2026-10-28')).toBe('1 mês');
    expect(ageLabel('2026-03-10', '2026-10-28')).toBe('7 meses');
    expect(ageLabel('2020-10-28', '2026-10-28')).toBe('6 anos');
  });
  it('plano de contas existe para todo segmento', () => {
    for (const seg of SEGMENTS) expect(defaultChartOfAccounts(seg).some((c) => c.type === 'DESPESA')).toBe(true);
    expect(defaultChartOfAccounts('INEXISTENTE' as never).length).toBeGreaterThan(0);
  });
  it('iniciais', () => {
    expect(initials('Ana Paula Souza')).toBe('AS');
    expect(initials('ana')).toBe('A');
    expect(initials('   ')).toBe('');
  });
});

describe('senha e redirecionamento', () => {
  it('senhas comuns e problemas de senha', () => {
    expect(isCommonPassword('')).toBe(false);
    expect(isCommonPassword('aaaaaaaa')).toBe(true);
    expect(isCommonPassword('12345678')).toBe(true);
    expect(isCommonPassword('hgfedcba')).toBe(true);
    expect(isCommonPassword('Xk9!mQ2z')).toBe(false);
    expect(passwordProblem('curta')).toMatch(/pelo menos/);
    expect(passwordProblem('x'.repeat(129))).toMatch(/no máximo/);
    expect(passwordProblem('12345678')).toMatch(/comum/);
    expect(passwordProblem('Xk9!mQ2zpL')).toBeNull();
  });
  it('safeNext só aceita caminho interno', () => {
    expect(safeNext('/agenda?dia=1#x')).toBe('/agenda?dia=1#x');
    expect(safeNext(null)).toBe('/inicio');
    expect(safeNext('//evil.com')).toBe('/inicio');
    expect(safeNext('/\\evil.com', '/x')).toBe('/x');
    expect(safeNext('https://evil.com')).toBe('/inicio');
    expect(safeNext('/@evil.com/x')).toBe('/@evil.com/x');
    expect(safeNext('/%')).toBe('/%');
  });
});

describe('lembretes, fidelidade, segmentos e estoque', () => {
  it('dueReminder usa o relógio real por padrão', () => {
    const a = { startsAt: new Date(Date.now() + 3_600_000).toISOString(), createdAt: '2020-01-01T00:00:00Z', status: 'AGENDADO', reminded24At: null, reminded2At: null };
    expect(['H24', 'H2', null]).toContain(dueReminder(a));
    expect(dueReminder({ ...a, status: 'CANCELADO' })).toBeNull();
  });
  it('regra de pontos: cada campo tem a sua mensagem', () => {
    const ok = { pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 500 };
    expect(validateLoyalty(ok as never)).toBeNull();
    expect(validateLoyalty({ ...ok, pointsPerReal: 0 } as never)).toMatch(/Pontos por real/);
    expect(validateLoyalty({ ...ok, redeemPoints: 0 } as never)).toMatch(/resgate/);
    expect(validateLoyalty({ ...ok, redeemValueCents: 0 } as never)).toMatch(/maior que zero/);
  });
  it('vocabulário por segmento', () => {
    for (const seg of SEGMENTS) expect(vocabularyFor(seg)).toBe(SEGMENT_PRESETS[seg].vocabulary);
  });
  it('curva ABC: valor zero e total zero caem na classe C', () => {
    const r = abcClasses([{ id: 'a', valueCents: 0 }, { id: 'b', valueCents: 0 }]);
    expect(r.get('a')).toBe('C');
    expect(abcClasses([{ id: 'a', valueCents: 1000 }, { id: 'b', valueCents: 0 }]).get('b')).toBe('C');
  });
});

describe('relatórios: ramos raros', () => {
  it('minutos de trabalho em semana sem faixas', () => {
    expect(workingMinutes([] as never, '2026-11-02', '2026-11-03')).toBe(0);
    expect(workingMinutes([[], [{ start: '09:00', end: '10:00' }], [], [], [], [], []], '2026-11-02', '2026-11-02')).toBe(60);
  });
  it('aniversário de 29/02 em ano comum cai em 28/02 e sem ano válido não informa a idade', () => {
    const r = upcomingBirthdays(
      [
        { id: 'a', name: 'Bia', phone: '1', birthDate: '2000-02-29' },
        { id: 'b', name: 'Caio', phone: '2', birthDate: '1900-02-28' },
      ],
      '2027-02-20',
      14,
    );
    expect(r.find((x) => x.clientId === 'a')?.date).toBe('2027-02-28');
    expect(r.find((x) => x.clientId === 'b')?.turns).toBeNull();
  });
  it('mensagens prontas usam só o primeiro nome', () => {
    expect(comebackMessage({ name: 'Ana Souza' }, 'Clínica')).toContain('Oi, Ana!');
    expect(birthdayMessage({ name: 'Ana Souza' }, 'Clínica')).toContain('Parabéns, Ana!');
  });
  it('visão geral sem agendamentos nem horário de trabalho', () => {
    const o = buildOverview({ from: '2026-10-01', to: '2026-10-31', rows: [], availableByMember: {}, priorClientIds: new Set<string>() } as never);
    expect(o.total).toBe(0);
    expect(o.ticketCents).toBeNull();
    expect(o.occupancyPct).toBeNull();
  });
});
