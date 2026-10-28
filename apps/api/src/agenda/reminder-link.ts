import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Link dos lembretes por e-mail: assinado (HMAC), preso a UM agendamento e com validade.
 * Funciona no lugar do código da reserva (que só existe como hash no banco): `/reserva/<este código>`.
 * Começa com `r.` — os códigos de reserva comuns nunca têm ponto.
 */
const mac = (secret: string, body: string) => createHmac('sha256', secret).update(`reminder-link:${body}`).digest('base64url');

export function signReminderLink(secret: string, appointmentId: string, expiresAtMs: number): string {
  const body = Buffer.from(JSON.stringify({ a: appointmentId, e: Math.floor(expiresAtMs / 1000) })).toString('base64url');
  return `r.${body}.${mac(secret, body)}`;
}

/** Devolve o id do agendamento se a assinatura confere e não venceu. */
export function readReminderLink(secret: string, token: string, now = Date.now()): string | null {
  if (!token.startsWith('r.') || token.length > 400) return null;
  const [, body, given] = token.split('.');
  if (!body || !given) return null;
  const expected = mac(secret, body);
  if (expected.length !== given.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as { a: string; e: number };
    return typeof c.a === 'string' && typeof c.e === 'number' && c.e * 1000 > now ? c.a : null;
  } catch {
    return null;
  }
}
