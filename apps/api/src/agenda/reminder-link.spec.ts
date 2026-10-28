import { readReminderLink, signReminderLink } from './reminder-link';

const SECRET = 'segredo-de-teste-segredo-de-teste-12';
const ID = '3f2b1c9e-0000-4000-8000-000000000001';

describe('link do lembrete', () => {
  it('assina e lê o id do agendamento', () => {
    const t = signReminderLink(SECRET, ID, Date.now() + 60_000);
    expect(t.startsWith('r.')).toBe(true);
    expect(readReminderLink(SECRET, t)).toBe(ID);
  });
  it('recusa vencido, adulterado, de outro segredo e lixo', () => {
    expect(readReminderLink(SECRET, signReminderLink(SECRET, ID, Date.now() - 1000))).toBeNull();
    const t = signReminderLink(SECRET, ID, Date.now() + 60_000);
    const [p, body, mac] = t.split('.');
    const other = Buffer.from(JSON.stringify({ a: 'outro-id', e: 9999999999 })).toString('base64url');
    expect(readReminderLink(SECRET, `${p}.${other}.${mac}`)).toBeNull();
    expect(readReminderLink('outro-segredo-outro-segredo-outro-12', t)).toBeNull();
    expect(readReminderLink(SECRET, `${p}.${body}.`)).toBeNull();
    expect(readReminderLink(SECRET, 'abc')).toBeNull();
    expect(readReminderLink(SECRET, 'r.' + 'x'.repeat(500))).toBeNull();
  });
});
