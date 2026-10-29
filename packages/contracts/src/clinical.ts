/**
 * Módulo clínico (mínimo da Fase 5): prontuário, fichas de anamnese e termos de consentimento.
 * Tudo aqui guarda dado de saúde (LGPD art. 11): a API cifra e só `Permission.CLINICAL_RECORDS` lê.
 */
import type { IsoDate } from './dates';
import type { Segment } from './segments';

// ------------------------------------------------------------------ prontuário

export const RECORD_KINDS = ['EVOLUCAO', 'PRESCRICAO', 'ATESTADO'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export const RECORD_KIND_LABEL: Record<RecordKind, string> = {
  EVOLUCAO: 'Evolução',
  PRESCRICAO: 'Prescrição',
  ATESTADO: 'Atestado',
};
export const RECORD_CONTENT_MAX = 8000;
/** Quem escreveu pode apagar só dentro desta janela (erro de digitação); depois fica registrado. */
export const RECORD_DELETE_WINDOW_HOURS = 24;

export interface ClinicalRecordDto {
  id: string;
  clientId: string;
  kind: RecordKind;
  title: string | null;
  content: string;
  authorName: string;
  appointmentId: string | null;
  createdAt: string;
  /** O próprio autor, ainda dentro da janela. */
  canDelete: boolean;
}

export interface ClinicalRecordInput {
  kind: RecordKind;
  title?: string | null;
  content: string;
  appointmentId?: string | null;
}

export function canDeleteRecord(createdAt: string, authorMemberId: string, memberId: string, now = Date.now()): boolean {
  return authorMemberId === memberId && now - new Date(createdAt).getTime() < RECORD_DELETE_WINDOW_HOURS * 3_600_000;
}

/** Título do painel ao criar. */
export const RECORD_SHEET_TITLE: Record<RecordKind, string> = {
  EVOLUCAO: 'Nova evolução',
  PRESCRICAO: 'Nova prescrição',
  ATESTADO: 'Novo atestado',
};

export const RECORD_KIND_HINT: Record<RecordKind, string> = {
  EVOLUCAO: 'O que foi visto e o que foi feito neste atendimento.',
  PRESCRICAO: 'Medicamentos e posologia. Imprima e assine se o conselho exigir papel.',
  ATESTADO: 'Dias de afastamento. Imprima e assine se o conselho exigir papel.',
};

export const RX_LINES_MAX = 8;
export const CERTIFICATE_DAYS_MAX = 365;

export type RecordFieldType = 'text' | 'long' | 'number' | 'select';
export type RecordFieldGroup = 'vitals';

export interface RecordField {
  id: string;
  label: string;
  type: RecordFieldType;
  placeholder?: string;
  hint?: string;
  options?: readonly string[];
  required?: boolean;
  group?: RecordFieldGroup;
}

export interface RxLine {
  name: string;
  dose: string;
  schedule: string;
  duration: string;
}

export interface RecordSection {
  label: string;
  value: string;
}

export interface ComposeRecordInput {
  kind: RecordKind;
  segment: Segment;
  values: Record<string, string>;
  rx?: readonly RxLine[];
  patientName?: string;
}

const F = (id: string, label: string, type: RecordFieldType, extra: Partial<RecordField> = {}): RecordField => ({
  id,
  label,
  type,
  ...extra,
});

export function emptyRxLine(): RxLine {
  return { name: '', dose: '', schedule: '', duration: '' };
}

/** Uma linha da receita; sem o nome do medicamento, some. */
export function formatRxLine(line: RxLine): string | null {
  const name = line.name.trim();
  if (!name) return null;
  const dose = line.dose.trim();
  const schedule = line.schedule.trim();
  const duration = line.duration.trim();
  const how = [dose, schedule, duration ? `por ${duration}` : ''].filter(Boolean).join(' ');
  return how ? `${name} — ${how}` : name;
}

export function numberedRx(lines: readonly RxLine[]): string {
  return lines
    .map(formatRxLine)
    .filter((s): s is string => !!s)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');
}

const VITAL_FMT: { id: string; prefix: string; suffix?: string }[] = [
  { id: 'pa', prefix: 'PA' },
  { id: 'fc', prefix: 'FC' },
  { id: 'temp', prefix: 'Temp', suffix: '°C' },
  { id: 'peso', prefix: 'Peso', suffix: 'kg' },
  { id: 'altura', prefix: 'Altura', suffix: 'cm' },
];

export function formatVitals(values: Record<string, string>): string | null {
  const parts = VITAL_FMT.flatMap(({ id, prefix, suffix }) => {
    const v = (values[id] ?? '').trim();
    return v ? [`${prefix} ${v}${suffix ? ` ${suffix}` : ''}`] : [];
  });
  return parts.length ? parts.join(' · ') : null;
}

export function composeCertificateBody(days: number, patientName?: string): string {
  const who = patientName?.trim() ? patientName.trim() : 'o(a) paciente';
  const n = Math.trunc(days);
  const afastamento = n === 1 ? '1 dia' : `${n} dias`;
  return `Atesto, para os devidos fins, que ${who} esteve sob cuidados profissionais nesta data, necessitando de ${afastamento} de afastamento das atividades habituais.`;
}

export function suggestedRecordTitle(kind: RecordKind, segment: Segment): string {
  if (kind === 'PRESCRICAO') return 'Receituário';
  if (kind === 'ATESTADO') return 'Atestado';
  if (segment === 'CLINICA_MEDICA') return 'Consulta';
  if (segment === 'ODONTOLOGIA') return 'Atendimento odontológico';
  if (segment === 'ESTETICA' || segment === 'TERAPIAS') return 'Sessão';
  return 'Atendimento';
}

function evolutionFields(segment: Segment): RecordField[] {
  if (segment === 'CLINICA_MEDICA') {
    return [
      F('queixa', 'Queixa', 'long', { required: true, placeholder: 'O que trouxe o paciente hoje?' }),
      F('exame', 'Exame', 'long', { placeholder: 'Achados do exame físico ou complementar.' }),
      F('pa', 'PA', 'text', { group: 'vitals', placeholder: '120/80' }),
      F('fc', 'FC', 'text', { group: 'vitals', placeholder: '80' }),
      F('temp', 'Temp.', 'text', { group: 'vitals', placeholder: '36,5' }),
      F('peso', 'Peso', 'text', { group: 'vitals', placeholder: 'kg' }),
      F('altura', 'Altura', 'text', { group: 'vitals', placeholder: 'cm' }),
      F('avaliacao', 'Avaliação', 'text', { placeholder: 'Hipótese ou impressão clínica.' }),
      F('conduta', 'Conduta', 'long', { placeholder: 'Plano, exames, retorno.' }),
    ];
  }
  if (segment === 'ODONTOLOGIA') {
    return [
      F('dente', 'Dente ou região', 'text', { placeholder: '26, 11-21, hemiarcada…' }),
      F('procedimento', 'Procedimento realizado', 'long', { required: true, placeholder: 'O que foi feito nesta sessão.' }),
      F('anestesia', 'Anestesia', 'text', { placeholder: 'Tipo e tubetes, se houver.' }),
      F('materiais', 'Materiais', 'text', { placeholder: 'Resina, cimento, brocas…' }),
      F('proxima', 'Próxima visita', 'text', { placeholder: 'Retorno, próxima etapa.' }),
      F('notas', 'Observação', 'long'),
    ];
  }
  if (segment === 'ESTETICA') {
    return [
      F('area', 'Área', 'text', { placeholder: 'Face, abdômen, axilas…' }),
      F('procedimento', 'Procedimento', 'long', { required: true, placeholder: 'O que foi feito, parâmetros do aparelho.' }),
      F('produtos', 'Produtos ou aparelho', 'text', { placeholder: 'Marca, lote, intensidade.' }),
      F('reacao', 'Reação', 'select', { options: ['Nenhuma', 'Leve, sem conduta extra', 'Orientado retorno'] }),
      F('proxima', 'Próxima sessão', 'text'),
      F('notas', 'Observação', 'long'),
    ];
  }
  if (segment === 'TERAPIAS') {
    return [
      F('sessao', 'Nº da sessão', 'number', { placeholder: '1' }),
      F('queixa', 'Queixa do dia', 'long', { required: true, placeholder: 'Como chega nesta sessão.' }),
      F('conduta', 'Técnicas e conduta', 'long', { placeholder: 'O que foi trabalhado.' }),
      F('tarefa', 'Orientação', 'long', { placeholder: 'Tarefa, exercício, cuidado em casa.' }),
    ];
  }
  return [
    F('servico', 'Atendimento', 'text', { placeholder: 'O que foi feito.' }),
    F('produtos', 'Produtos usados', 'text'),
    F('observacao', 'Observação', 'long', { required: true, placeholder: 'Como foi a sessão, o que combinaram.' }),
  ];
}

/** Campos do formulário: mudam com o tipo da anotação e o segmento do negócio. */
export function recordFields(kind: RecordKind, segment: Segment): RecordField[] {
  if (kind === 'PRESCRICAO') {
    return [
      F('continuo', 'Uso contínuo', 'select', { options: ['Não', 'Sim'] }),
      F('orientacao', 'Orientação', 'long', { placeholder: 'Se piorar, retornar. Tomar com água…' }),
    ];
  }
  if (kind === 'ATESTADO') {
    return [
      F('dias', 'Dias de afastamento', 'number', { required: true, placeholder: '1' }),
      F('cid', 'CID', 'text', { placeholder: 'Opcional, se usar.', hint: 'Digite o código — não há busca automática.' }),
      F('observacao', 'Observação', 'long', { placeholder: 'Restrições ou recomendações.' }),
    ];
  }
  return evolutionFields(segment);
}

const VITAL_IDS = new Set<string>(VITAL_FMT.map((v) => v.id));

function sanitizeSectionValue(value: string): string {
  return value.replace(/^### /gm, '').trim();
}

function section(label: string, value: string): string | null {
  const v = sanitizeSectionValue(value);
  return v ? `### ${label}\n${v}` : null;
}

function certificateDays(values: Record<string, string>): number | null {
  const raw = (values.dias ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > CERTIFICATE_DAYS_MAX) return null;
  return n;
}

/** Monta o texto cifrado a partir dos campos. Anotações antigas (texto livre) continuam válidas. */
export function composeRecordContent(input: ComposeRecordInput): string {
  const fields = recordFields(input.kind, input.segment);
  const values = input.values;
  const blocks: string[] = [];
  if (input.kind === 'ATESTADO') {
    const days = certificateDays(values);
    if (days) blocks.push(section('Atestado', composeCertificateBody(days, input.patientName))!);
  }
  if (input.kind === 'PRESCRICAO') {
    const rx = numberedRx(input.rx ?? []);
    if (rx) blocks.push(section('Medicamentos', rx)!);
  }
  let vitalsEmitted = false;
  for (const f of fields) {
    if (f.id === 'dias') continue;
    if (VITAL_IDS.has(f.id)) {
      if (!vitalsEmitted) {
        const vitals = formatVitals(values);
        if (vitals) blocks.push(section('Sinais', vitals)!);
        vitalsEmitted = true;
      }
      continue;
    }
    const block = section(f.label, values[f.id] ?? '');
    if (block) blocks.push(block);
  }
  return blocks.join('\n\n');
}

/** Separa anotações novas (seções `###`) das antigas (texto livre vira "Notas"). */
export function parseRecordSections(content: string): RecordSection[] {
  const text = content.trim();
  if (!text) return [];
  if (!text.startsWith('### ')) return [{ label: 'Notas', value: text }];
  return text
    .split(/\n(?=### )/)
    .map((block) => {
      const nl = block.indexOf('\n');
      const label = (nl === -1 ? block : block.slice(0, nl)).replace(/^### /, '').trim();
      const value = (nl === -1 ? '' : block.slice(nl + 1)).trim();
      return { label, value };
    })
    .filter((s) => s.label);
}

/**
 * Erros do rascunho, chave = id do campo (`queixa`, `dias`, `rx`, `content`).
 * A tela prefixa com `rec-` para ligar ao input.
 */
export function recordDraftErrors(input: ComposeRecordInput): Record<string, string> {
  const fields = recordFields(input.kind, input.segment);
  if (input.kind === 'PRESCRICAO' && !numberedRx(input.rx ?? [])) {
    return { rx: 'Inclua ao menos um medicamento' };
  }
  if (input.kind === 'ATESTADO' && certificateDays(input.values) === null) {
    return { dias: 'Informe os dias de afastamento' };
  }
  for (const f of fields) {
    if (f.required && f.id !== 'dias' && !(input.values[f.id] ?? '').trim()) {
      return { [f.id]: 'Escreva a anotação' };
    }
  }
  const content = composeRecordContent(input);
  if (!content) return { content: 'Escreva a anotação' };
  if (content.length > RECORD_CONTENT_MAX) return { content: `No máximo ${RECORD_CONTENT_MAX} letras` };
  return {};
}

// ------------------------------------------------------------------ documentos do paciente

export const DOCUMENT_KINDS = ['ANAMNESE', 'TERMO'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = { ANAMNESE: 'Ficha de anamnese', TERMO: 'Termo de consentimento' };

export type QuestionType = 'TEXTO' | 'SIM_NAO' | 'ESCOLHA';
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = { TEXTO: 'Texto livre', SIM_NAO: 'Sim ou não', ESCOLHA: 'Escolha uma opção' };

export interface DocQuestion {
  id: string;
  label: string;
  type: QuestionType;
  /** Só para `ESCOLHA`. */
  options?: string[];
  required?: boolean;
}

export const QUESTIONS_MAX = 40;
export const ANSWER_MAX = 1000;
export const TERM_BODY_MAX = 8000;

export interface DocumentTemplateDto {
  id: string;
  kind: DocumentKind;
  title: string;
  questions: DocQuestion[];
  body: string | null;
  active: boolean;
  updatedAt: string;
}

export interface DocumentTemplateInput {
  kind: DocumentKind;
  title: string;
  questions?: DocQuestion[];
  body?: string | null;
  active?: boolean;
}

export type PatientDocumentStatus = 'PENDENTE' | 'PREENCHIDO';

export interface PatientDocumentDto {
  id: string;
  clientId: string;
  kind: DocumentKind;
  title: string;
  status: PatientDocumentStatus;
  sentAt: string;
  completedAt: string | null;
  completedVia: 'LINK' | 'EQUIPE' | null;
  expiresAt: string | null;
  /** Só na criação: o link para o paciente (o texto do token não é guardado). */
  link?: string;
}

export interface PatientDocumentDetailDto extends PatientDocumentDto {
  questions: DocQuestion[];
  body: string | null;
  answers: Record<string, string> | null;
  signedName: string | null;
}

/** O que o paciente vê no link (sem nenhum dado de outros pacientes). */
export interface PublicDocumentDto {
  organizationName: string;
  kind: DocumentKind;
  title: string;
  questions: DocQuestion[];
  body: string | null;
  patientFirstName: string;
  completed: boolean;
}

export interface SubmitDocumentRequest {
  answers?: Record<string, string>;
  /** Termo: quem aceita digita o nome (assinatura simples) e marca que leu. */
  signedName?: string;
  accepted?: boolean;
}

export const DOCUMENT_LINK_DAYS = 7;

/** Valida as respostas contra as perguntas. Devolve a mensagem do primeiro problema ou `null`. */
export function validateAnswers(questions: DocQuestion[], answers: Record<string, string> | undefined): string | null {
  const a = answers ?? {};
  for (const q of questions) {
    const v = (a[q.id] ?? '').trim();
    if (!v) {
      if (q.required) return `Responda: ${q.label}`;
      continue;
    }
    if (v.length > ANSWER_MAX) return `Resposta muito longa: ${q.label}`;
    if (q.type === 'SIM_NAO' && v !== 'SIM' && v !== 'NAO') return `Responda sim ou não: ${q.label}`;
    if (q.type === 'ESCOLHA' && !(q.options ?? []).includes(v)) return `Escolha uma das opções: ${q.label}`;
  }
  const known = new Set(questions.map((q) => q.id));
  if (Object.keys(a).some((k) => !known.has(k))) return 'Há respostas de perguntas que não existem nesta ficha';
  return null;
}

/** Só as respostas das perguntas conhecidas, aparadas e sem vazios. */
export function cleanAnswers(questions: DocQuestion[], answers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const v = (answers?.[q.id] ?? '').trim();
    if (v) out[q.id] = v;
  }
  return out;
}

/** Valida o modelo antes de gravar. */
export function validateTemplate(t: DocumentTemplateInput): string | null {
  if (!t.title.trim()) return 'Dê um nome para o modelo';
  if (t.kind === 'TERMO') {
    if (!t.body?.trim()) return 'Escreva o texto do termo';
    if (t.body.length > TERM_BODY_MAX) return `O termo passa de ${TERM_BODY_MAX} letras`;
    return null;
  }
  const qs = t.questions ?? [];
  if (!qs.length) return 'Inclua ao menos uma pergunta';
  if (qs.length > QUESTIONS_MAX) return `No máximo ${QUESTIONS_MAX} perguntas`;
  if (new Set(qs.map((q) => q.id)).size !== qs.length) return 'Há perguntas repetidas';
  for (const q of qs) {
    if (!q.label.trim()) return 'Toda pergunta precisa de um texto';
    if (q.type === 'ESCOLHA' && (q.options ?? []).filter((o) => o.trim()).length < 2) return `Inclua ao menos 2 opções em: ${q.label}`;
  }
  return null;
}

const Q = (id: string, label: string, type: QuestionType = 'TEXTO', extra: Partial<DocQuestion> = {}): DocQuestion => ({ id, label, type, ...extra });

/** Perguntas-modelo por segmento: o dono edita depois. */
export function defaultAnamnesis(segment: Segment): { title: string; questions: DocQuestion[] } {
  const base = [
    Q('alergias', 'Tem alergia a medicamentos, alimentos ou outros?', 'TEXTO'),
    Q('medicamentos', 'Usa algum medicamento? Qual e para quê?', 'TEXTO'),
    Q('doencas', 'Tem ou já teve alguma doença importante?', 'TEXTO'),
    Q('cirurgias', 'Já fez alguma cirurgia ou internação?', 'TEXTO'),
  ];
  if (segment === 'CLINICA_MEDICA') {
    return {
      title: 'Anamnese',
      questions: [
        Q('motivo', 'Qual o motivo da consulta?', 'TEXTO', { required: true }),
        ...base,
        Q('vacinas', 'As vacinas estão em dia?', 'SIM_NAO'),
        Q('gestacao', 'Intercorrências na gestação ou no parto (se for criança)?', 'TEXTO'),
        Q('historico', 'Histórico de doenças na família', 'TEXTO'),
      ],
    };
  }
  if (segment === 'ODONTOLOGIA') {
    return {
      title: 'Anamnese odontológica',
      questions: [
        Q('motivo', 'Qual o motivo da consulta?', 'TEXTO', { required: true }),
        ...base,
        Q('sangramento', 'Tem sangramento na gengiva ao escovar?', 'SIM_NAO'),
        Q('anestesia', 'Já teve reação à anestesia?', 'SIM_NAO'),
        Q('fuma', 'Fuma?', 'SIM_NAO'),
      ],
    };
  }
  if (segment === 'ESTETICA') {
    return {
      title: 'Ficha de avaliação',
      questions: [
        Q('objetivo', 'Qual o seu objetivo com o tratamento?', 'TEXTO', { required: true }),
        ...base,
        Q('gestante', 'Está grávida ou amamentando?', 'SIM_NAO'),
        Q('sol', 'Tomou sol ou fez algum procedimento recente?', 'TEXTO'),
      ],
    };
  }
  return { title: 'Ficha de anamnese', questions: [Q('motivo', 'O que você busca neste atendimento?', 'TEXTO', { required: true }), ...base] };
}

export function defaultTerm(orgName: string): { title: string; body: string } {
  return {
    title: 'Termo de consentimento',
    body: `Declaro que recebi as informações sobre o atendimento em ${orgName}, que as dúvidas que tive foram esclarecidas e que concordo com a realização do atendimento. Autorizo o registro dos meus dados de saúde e de atendimento (ou do paciente sob minha responsabilidade) para fins de cuidado, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Posso pedir acesso, correção ou exclusão dos dados a qualquer momento.`,
  };
}

/** Texto do WhatsApp com o link (o dono edita se quiser). */
export function documentMessage(p: { patientFirstName: string; orgName: string; title: string; link: string }): string {
  return `Olá! Aqui é de ${p.orgName}. Para agilizar o atendimento de ${p.patientFirstName}, preencha: ${p.title}. É rápido e fica guardado com segurança: ${p.link}`;
}

export type DocumentDate = IsoDate;
