/**
 * Só aceita caminhos internos no ?next= (evita open redirect).
 * Recusa '//site', '/\site' (navegadores tratam '\' como '/') e qualquer coisa que resolva para outra origem.
 */
export function safeNext(next: string | null, fallback = '/inicio'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  try {
    const base = 'https://agendei.invalid';
    const u = new URL(next, base);
    return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
