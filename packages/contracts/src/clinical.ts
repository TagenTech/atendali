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
