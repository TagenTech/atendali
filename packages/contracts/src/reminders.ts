/**
 * Lembretes automáticos por e-mail: 24 h e 2 h antes do atendimento (quando o cliente deixou e-mail).
 * A regra é pura e vale para o job do servidor e para os testes.
 */
export const REMINDER_RULES = {
  /** O lembrete "de véspera" sai quando faltam entre 3 h e 24 h. */
  dayBeforeMaxHours: 24,
  dayBeforeMinHours: 3,
  /** O lembrete "de hoje" sai quando faltam até 2 h. */
  soonHours: 2,
  /** Marcou há menos que isto: a confirmação acabou de chegar, não lembra de novo. */
  minAgeMinutes: 60,
} as const;

export type ReminderKind = 'H24' | 'H2';

export interface ReminderCandidate {
  startsAt: string;
  createdAt: string;
  status: string;
  reminded24At: string | null;
  reminded2At: string | null;
}

/** Qual lembrete está na hora (ou `null`). Só para quem ainda vai (agendado/confirmado). */
export function dueReminder(a: ReminderCandidate, now = Date.now()): ReminderKind | null {
  if (a.status !== 'AGENDADO' && a.status !== 'CONFIRMADO') return null;
  const until = new Date(a.startsAt).getTime() - now;
  if (until <= 0) return null;
  if (now - new Date(a.createdAt).getTime() < REMINDER_RULES.minAgeMinutes * 60_000) return null;
  const hours = until / 3_600_000;
  if (hours <= REMINDER_RULES.soonHours) return a.reminded2At ? null : 'H2';
  if (hours <= REMINDER_RULES.dayBeforeMaxHours && hours > REMINDER_RULES.dayBeforeMinHours) return a.reminded24At ? null : 'H24';
  return null;
}

export const REMINDER_LABEL: Record<ReminderKind, string> = { H24: 'amanhã', H2: 'daqui a pouco' };
