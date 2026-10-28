/**
 * CSV: leitura (importação de clientes) e escrita segura (planilha não executa fórmula).
 */
import { isIsoDate } from './dates';
import { isValidPhone, normalizePhone } from './phone';

/** Detecta o separador (; , ou tab) pela primeira linha, ignorando o que está entre aspas. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',';
}

/** Lê CSV (RFC 4180: aspas, aspas duplas, quebra de linha dentro do campo; BOM; ; , ou tab). Ignora linhas em branco. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) endCell();
    else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

/** Neutraliza injeção de fórmula (= + - @ ou tab/CR no começo) ao escrever numa planilha. */
export function csvSafe(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Escreve CSV (separador `;`, CRLF, BOM para o Excel) com todas as células neutralizadas. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = csvSafe(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(cell).join(';')).join('\r\n')}\r\n`;
}

// ------------------------------------------------------------------ importação de clientes

export const CLIENT_IMPORT_MAX_ROWS = 1000;
export const CLIENT_IMPORT_MAX_CHARS = 400_000;

export interface ClientImportData {
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  tags: string[];
  notes: string | null;
}

export type ClientImportRowStatus = 'OK' | 'DUPLICADO' | 'ERRO';

export interface ClientImportRow {
  /** Linha no arquivo (cabeçalho = 1). */
  line: number;
  status: ClientImportRowStatus;
  /** Motivo, quando não é OK. */
  reason: string | null;
  data: ClientImportData | null;
  /** Nome como veio, para mostrar mesmo nas linhas com erro. */
  label: string;
}

export interface ClientImportPreview {
  /** Colunas reconhecidas, na ordem do arquivo. */
  columns: string[];
  rows: ClientImportRow[];
  counts: { ok: number; duplicated: number; errors: number; total: number };
  /** Problema geral do arquivo (sem coluna de nome, vazio, grande demais). */
  fatal: string | null;
}

export interface ClientImportReport {
  imported: number;
  duplicated: number;
  errors: number;
  rows: ClientImportRow[];
}

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['nome', 'nomecompleto', 'cliente', 'paciente', 'name'],
  phone: ['celular', 'telefone', 'whatsapp', 'fone', 'tel', 'phone', 'celularwhatsapp'],
  email: ['email', 'emails', 'correioeletronico'],
  birthDate: ['nascimento', 'datanascimento', 'datadenascimento', 'aniversario', 'dtnascimento', 'birthdate'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'tag', 'marcadores'],
  notes: ['observacoes', 'observacao', 'obs', 'notas', 'anotacoes', 'notes'],
};

const slugHeader = (h: string) =>
  h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** 'DD/MM/AAAA', 'DD-MM-AAAA' ou 'AAAA-MM-DD' → 'AAAA-MM-DD' (ou null se não for uma data real). */
export function parseBirthDate(raw: string): string | null {
  const s = raw.trim();
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  const iso = br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : s;
  return isIsoDate(iso) && iso >= '1900-01-01' ? iso : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida o arquivo linha a linha. `existingPhones`/`existingEmails` são do negócio (só dígitos / minúsculas);
 * quem repete um celular (no arquivo ou no negócio) é ignorado. Sem celular, repete-se pelo e-mail.
 */
export function previewClientImport(csv: string, existing: { phones: Iterable<string>; emails: Iterable<string> }): ClientImportPreview {
  const empty = (fatal: string): ClientImportPreview => ({ columns: [], rows: [], counts: { ok: 0, duplicated: 0, errors: 0, total: 0 }, fatal });
  if (csv.length > CLIENT_IMPORT_MAX_CHARS) return empty('Arquivo grande demais. Divida em partes menores.');
  const table = parseCsv(csv);
  if (table.length < 2) return empty('Não encontrei linhas para importar. A primeira linha deve ter os nomes das colunas.');
  const header = table[0].map(slugHeader);
  const col = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, header.findIndex((h) => aliases.includes(h))]),
  ) as Record<keyof typeof COLUMN_ALIASES, number>;
  if (col.name < 0) return empty('Falta a coluna "Nome" na primeira linha.');
  if (table.length - 1 > CLIENT_IMPORT_MAX_ROWS) return empty(`Máximo de ${CLIENT_IMPORT_MAX_ROWS} linhas por arquivo.`);
  const columns = (Object.keys(col) as (keyof typeof col)[]).filter((k) => col[k] >= 0).sort((a, b) => col[a] - col[b]);

  const phones = new Set(existing.phones);
  const emails = new Set(existing.emails);
  const get = (r: string[], key: keyof typeof col) => (col[key] >= 0 ? (r[col[key]] ?? '').trim() : '');

  const rows: ClientImportRow[] = table.slice(1).map((r, k) => {
    const line = k + 2;
    const name = get(r, 'name');
    const bad = (reason: string): ClientImportRow => ({ line, status: 'ERRO', reason, data: null, label: name || '(sem nome)' });
    if (!name) return bad('Falta o nome');
    if (name.length > 120) return bad('Nome com mais de 120 letras');
    const phoneRaw = get(r, 'phone');
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phone && !isValidPhone(phone)) return bad('Celular inválido — use DDD + número');
    const email = get(r, 'email').toLowerCase() || null;
    if (email && (!EMAIL.test(email) || email.length > 180)) return bad('E-mail inválido');
    const birthRaw = get(r, 'birthDate');
    const birthDate = birthRaw ? parseBirthDate(birthRaw) : null;
    if (birthRaw && !birthDate) return bad('Nascimento inválido — use DD/MM/AAAA');
    const notes = get(r, 'notes') || null;
    if (notes && notes.length > 2000) return bad('Observações com mais de 2000 letras');
    const tags = [...new Set(get(r, 'tags').split(/[|,;]/).map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 10);

    const data: ClientImportData = { name, phone, email, birthDate, tags, notes };
    const dupPhone = phone ? phones.has(phone) : false;
    const dupEmail = !phone && email ? emails.has(email) : false;
    if (dupPhone || dupEmail) {
      return { line, status: 'DUPLICADO', reason: dupPhone ? 'Celular já cadastrado' : 'E-mail já cadastrado', data, label: name };
    }
    if (phone) phones.add(phone);
    if (email) emails.add(email);
    return { line, status: 'OK', reason: null, data, label: name };
  });

  const count = (s: ClientImportRowStatus) => rows.filter((r) => r.status === s).length;
  return { columns, rows, counts: { ok: count('OK'), duplicated: count('DUPLICADO'), errors: count('ERRO'), total: rows.length }, fatal: null };
}
