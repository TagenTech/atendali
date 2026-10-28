import { dueReminder, type ReminderCandidate } from './reminders';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const at = (hoursFromNow: number) => new Date(NOW + hoursFromNow * 3_600_000).toISOString();
const base = (over: Partial<ReminderCandidate>): ReminderCandidate => ({
  startsAt: at(20),
  createdAt: at(-48),
  status: 'AGENDADO',
  reminded24At: null,
  reminded2At: null,
  ...over,
});

describe('lembretes', () => {
  it('véspera: entre 3 h e 24 h antes, uma vez só', () => {
    expect(dueReminder(base({ startsAt: at(23.5) }), NOW)).toBe('H24');
    expect(dueReminder(base({ startsAt: at(24.5) }), NOW)).toBeNull(); // ainda cedo
    expect(dueReminder(base({ startsAt: at(5) }), NOW)).toBe('H24');
    expect(dueReminder(base({ startsAt: at(5), reminded24At: at(-1) }), NOW)).toBeNull();
  });

  it('de hoje: até 2 h antes, uma vez só', () => {
    expect(dueReminder(base({ startsAt: at(1.5) }), NOW)).toBe('H2');
    expect(dueReminder(base({ startsAt: at(1.5), reminded2At: at(-0.1) }), NOW)).toBeNull();
    expect(dueReminder(base({ startsAt: at(2.5) }), NOW)).toBeNull(); // entre 2 h e 3 h não manda nenhum
  });

  it('não lembra quem acabou de marcar, quem já foi, quem cancelou ou faltou', () => {
    expect(dueReminder(base({ startsAt: at(20), createdAt: at(-0.5) }), NOW)).toBeNull();
    expect(dueReminder(base({ startsAt: at(-1) }), NOW)).toBeNull();
    for (const status of ['CANCELADO', 'FALTOU', 'CONCLUIDO', 'CHEGOU', 'EM_ATENDIMENTO']) expect(dueReminder(base({ status }), NOW)).toBeNull();
    expect(dueReminder(base({ status: 'CONFIRMADO' }), NOW)).toBe('H24');
  });
});
