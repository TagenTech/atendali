/**
 * Telefones guardados num formato só:
 * - Brasil: só dígitos, DDD + número ('11987654321'), como sempre foi;
 * - outros países (aulas online): E.164 com "+" ('+14155552671').
 * Números "+55…" são tratados como Brasil e perdem o "+55".
 */

/** "+" + até 15 dígitos (E.164). */
export const PHONE_MAX_LENGTH = 16;

export function isInternationalPhone(value: string): boolean {
  return value.startsWith('+');
}

/** Espaço sem quebra e marcas de direção de texto que contatos/WhatsApp colocam ao copiar um número. */
const INVISIBLE = /[\u00a0\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

export function normalizePhone(input: string): string {
  const raw = input.replace(INVISIBLE, ' ').trim();
  let digits = raw.replace(/\D/g, '');
  // "00" é o prefixo internacional de discagem (nenhum DDD brasileiro começa com 0).
  const dialedOut = raw.startsWith('00');
  if (raw.startsWith('+') || dialedOut) {
    if (dialedOut) digits = digits.slice(2);
    // +55 com o número completo é Brasil; incompleto fica como está enquanto a pessoa digita.
    if (digits.startsWith('55') && digits.length >= 12) return digits.slice(2);
    return `+${digits}`;
  }
  // Zero na frente é o "0" de discagem interurbana ("011 98765-4321"): DDD brasileiro não começa com 0.
  digits = digits.replace(/^0+/, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
}

export function isValidPhone(value: string): boolean {
  if (isInternationalPhone(value)) return /^\+(?!55)[1-9]\d{7,14}$/.test(value);
  return /^[1-9]\d(9\d{8}|[2-8]\d{7})$/.test(value);
}

/** Países com código de 2 dígitos (os demais, exceto 1 e 7, têm 3). */
const TWO_DIGIT_COUNTRY_CODES = new Set([
  20, 27, 30, 31, 32, 33, 34, 36, 39, 40, 41, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63,
  64, 65, 66, 81, 82, 84, 86, 90, 91, 92, 93, 94, 95, 98,
]);

function countryCodeLength(digits: string): number {
  if (digits[0] === '1' || digits[0] === '7') return 1;
  return TWO_DIGIT_COUNTRY_CODES.has(Number(digits.slice(0, 2))) ? 2 : 3;
}

/** '+14155552671' → '+1 415 555 2671'. */
function formatInternational(value: string): string {
  const digits = value.slice(1);
  const cc = countryCodeLength(digits);
  if (digits.length <= cc) return `+${digits}`;
  let rest = digits.slice(cc);
  const groups: string[] = [];
  while (rest.length > 4) {
    groups.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  return `+${digits.slice(0, cc)} ${[...groups, rest].join(' ')}`;
}

/** Máscara progressiva para digitação: '1198765' → '(11) 9876-5'; '+4' → '+4'. */
export function formatPhone(input: string): string {
  const normalized = normalizePhone(input);
  if (isInternationalPhone(normalized)) return formatInternational(normalized);
  const d = normalized.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Número completo com DDI para discar: '11987654321' → '+5511987654321'; internacional segue igual. */
export function dialNumber(phone: string): string {
  const n = normalizePhone(phone);
  return isInternationalPhone(n) ? n : `+55${n}`;
}

/** Link do WhatsApp (DDI 55 para números do Brasil), opcionalmente com mensagem pronta. */
export function whatsappLink(phone: string, text?: string): string {
  const base = `https://wa.me/${dialNumber(phone).slice(1)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
