/**
 * Criptografia de campos sensíveis em repouso (ex.: CPF).
 * - AES-256-GCM (confidencialidade + integridade), IV aleatório por valor.
 * - "Índice cego" HMAC-SHA256 para buscar/garantir unicidade sem guardar o texto.
 * A chave vem de DATA_ENCRYPTION_KEY (32 bytes em base64) e fica FORA do banco.
 * Formato: "v1:" + base64(iv[12] | tag[16] | cifra).
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'crypto';

let cachedKey: { raw: string; enc: Buffer; idx: Buffer } | null = null;

function keys() {
  const raw = process.env.DATA_ENCRYPTION_KEY ?? '';
  if (cachedKey?.raw === raw) return cachedKey;
  const master = Buffer.from(raw, 'base64');
  if (master.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY ausente ou inválida (32 bytes em base64: openssl rand -base64 32)');
  }
  // Chaves separadas para cifrar e para o índice (derivadas da mestra).
  // Os rótulos "aulinha:*" são só um separador criptográfico (nome antigo do app): NÃO renomeie,
  // senão as chaves derivadas mudam e tudo que já foi cifrado (CPF, 2FA) fica ilegível.
  const enc = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'aulinha:field-encryption', 32));
  const idx = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'aulinha:blind-index', 32));
  cachedKey = { raw, enc, idx };
  return cachedKey;
}

export function assertEncryptionKey() {
  keys();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys().enc, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

export function decryptField(stored: string): string {
  if (!stored.startsWith('v1:')) throw new Error('Formato de campo cifrado desconhecido');
  const buf = Buffer.from(stored.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keys().enc, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

/** HMAC determinístico (mesmo valor → mesmo índice), sem revelar o valor. */
export function blindIndex(value: string, purpose: string): string {
  return createHmac('sha256', keys().idx).update(`${purpose}:${value}`).digest('hex');
}
