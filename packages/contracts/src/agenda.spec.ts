import {
  availableSlots,
  canClientCancel,
  canMoveTo,
  confirmationMessage,
  occupiesSlot,
  overlaps,
  slotOpenedMessage,
  waitlistMatches,
  withinBusinessHours,
} from './agenda';
import { defaultBusinessHours } from './business-hours';
import { zonedToUtc } from './time';

const TZ = 'America/Sao_Paulo';
const at = (date: string, time: string) => zonedToUtc(date, time, TZ).getTime();
// 2026-11-02 é segunda-feira; 2026-11-08, domingo.
const MON = '2026-11-02';

describe('disponibilidade', () => {
  const hours = defaultBusinessHours();
  hours[1] = [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '15:00' },
  ];

  it('respeita faixas, duração e passo; não atravessa o almoço', () => {
    const slots = availableSlots({ date: MON, timezone: TZ, hours, durationMinutes: 60, busy: [], stepMinutes: 30 });
    const local = slots.map((s) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }));
    expect(local).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00']);
  });

  it('pula o que está ocupado e o que é antes da antecedência mínima', () => {
    const busy = [{ start: at(MON, '10:00'), end: at(MON, '11:00') }];
    const slots = availableSlots({ date: MON, timezone: TZ, hours, durationMinutes: 60, busy, stepMinutes: 60, notBefore: at(MON, '09:30') });
    expect(slots.map((s) => new Date(s).getTime())).toEqual([at(MON, '11:00'), at(MON, '13:00'), at(MON, '14:00')]);
  });

  it('dia fechado não tem horário', () => {
    expect(availableSlots({ date: '2026-11-08', timezone: TZ, hours, durationMinutes: 30, busy: [] })).toEqual([]);
  });

  it('encostar não é sobrepor', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
  });

  it('withinBusinessHours confere a faixa inteira no fuso da unidade', () => {
    expect(withinBusinessHours(new Date(at(MON, '11:00')), new Date(at(MON, '12:00')), hours, TZ)).toBe(true);
    expect(withinBusinessHours(new Date(at(MON, '11:30')), new Date(at(MON, '12:30')), hours, TZ)).toBe(false);
    expect(withinBusinessHours(new Date(at('2026-11-08', '10:00')), new Date(at('2026-11-08', '11:00')), hours, TZ)).toBe(false);
  });
});

describe('status', () => {
  it('fluxo do dia', () => {
    expect(canMoveTo('AGENDADO', 'CHEGOU')).toBe(true);
    expect(canMoveTo('CONCLUIDO', 'CANCELADO')).toBe(false);
    expect(canMoveTo('CANCELADO', 'AGENDADO')).toBe(true);
    expect(canMoveTo('FALTOU', 'FALTOU')).toBe(true);
  });

  it('cancelado libera o horário; falta não', () => {
    expect(occupiesSlot('CANCELADO')).toBe(false);
    expect(occupiesSlot('FALTOU')).toBe(true);
  });

  it('cliente cancela online até 2h antes, só se ainda não foi atendido', () => {
    const now = at(MON, '08:00');
    expect(canClientCancel('AGENDADO', new Date(at(MON, '10:00')).toISOString(), now)).toBe(true);
    expect(canClientCancel('AGENDADO', new Date(at(MON, '09:59')).toISOString(), now)).toBe(false);
    expect(canClientCancel('CONCLUIDO', new Date(at(MON, '18:00')).toISOString(), now)).toBe(false);
  });
});

describe('mensagem de confirmação', () => {
  it('data e hora no fuso da unidade', () => {
    const msg = confirmationMessage({
      clientName: 'Ana Paula',
      organizationName: 'Studio Bella',
      serviceName: 'Corte',
      professionalName: 'Rita',
      startsAt: new Date(at(MON, '14:30')).toISOString(),
      timezone: TZ,
      priceCents: 8000,
    });
    expect(msg.replace(/ /g, ' ')).toBe(
      'Oi, Ana! Seu horário em Studio Bella: Corte (R$ 80,00) com Rita, dia 02/11/2026 às 14:30. Pode confirmar respondendo esta mensagem? 😊',
    );
  });
});

describe('lista de espera', () => {
  const freed = { serviceId: 's1', memberId: 'm1', date: '2026-11-03' };
  it('combina quando cada preferência é vazia ou igual', () => {
    expect(waitlistMatches({ serviceId: null, memberId: null, preferredDate: null }, freed)).toBe(true);
    expect(waitlistMatches({ serviceId: 's1', memberId: 'm1', preferredDate: '2026-11-03' }, freed)).toBe(true);
    expect(waitlistMatches({ serviceId: 's2', memberId: null, preferredDate: null }, freed)).toBe(false);
    expect(waitlistMatches({ serviceId: null, memberId: 'm2', preferredDate: null }, freed)).toBe(false);
    expect(waitlistMatches({ serviceId: null, memberId: null, preferredDate: '2026-11-04' }, freed)).toBe(false);
  });

  it('mensagem de vaga no fuso da unidade', () => {
    const msg = slotOpenedMessage({
      clientName: 'Bruna Lima',
      organizationName: 'Studio',
      startsAt: new Date(at(MON, '15:00')).toISOString(),
      timezone: TZ,
      professionalName: 'Rita',
    });
    expect(msg).toBe('Oi, Bruna! Abriu um horário em Studio: dia 02/11 às 15:00 com Rita. Quer que eu reserve para você? 😊');
  });
});
