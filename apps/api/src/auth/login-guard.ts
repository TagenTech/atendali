/**
 * Freio contra força bruta por conta (o throttler já limita por IP):
 * 5 senhas erradas para o mesmo e-mail em 15 min bloqueiam novas tentativas por 15 min.
 * Em memória — com várias instâncias da API, mover para Redis.
 */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;

interface Entry {
  fails: number;
  first: number;
  lockedUntil: number;
}

export class LoginAttempts {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Bloqueado agora? Devolve os minutos restantes ou 0. */
  lockedFor(email: string): number {
    const e = this.map.get(email.toLowerCase());
    if (!e || e.lockedUntil <= this.now()) return 0;
    return Math.ceil((e.lockedUntil - this.now()) / 60_000);
  }

  /** Registra uma falha; devolve true se a conta acabou de ser bloqueada. */
  fail(email: string): boolean {
    const key = email.toLowerCase();
    const now = this.now();
    const e = this.map.get(key);
    const entry = !e || now - e.first > WINDOW_MS ? { fails: 0, first: now, lockedUntil: 0 } : e;
    entry.fails++;
    if (entry.fails >= MAX_FAILS) entry.lockedUntil = now + WINDOW_MS;
    this.map.set(key, entry);
    if (this.map.size > 10_000) this.prune();
    return entry.fails === MAX_FAILS;
  }

  success(email: string) {
    this.map.delete(email.toLowerCase());
  }

  private prune() {
    const now = this.now();
    for (const [k, e] of this.map) if (now - e.first > WINDOW_MS && e.lockedUntil <= now) this.map.delete(k);
  }
}

/** 'filipe@gmail.com' → 'fi***@gmail.com' (para logs). */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain ?? ''}`;
}
