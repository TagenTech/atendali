import { buildOverview, daysBetween, upcomingBirthdays, workingMinutes, type ReportRow } from './reports';
import { defaultBusinessHours } from './business-hours';

const row = (o: Partial<ReportRow>): ReportRow => ({
  status: 'CONCLUIDO',
  startsAt: '2026-11-10T13:00:00.000Z',
  endsAt: '2026-11-10T14:00:00.000Z',
  serviceId: 's1',
  serviceName: 'Corte',
  memberId: 'm1',
  memberName: 'Ana',
  clientId: 'c1',
  priceCents: 8000,
  source: 'INTERNO',
  ...o,
});

describe('relatórios', () => {
  it('minutos de trabalho: seg–sex 9–19 e sábado 9–14', () => {
    const h = defaultBusinessHours();
    expect(workingMinutes(h, '2026-11-09', '2026-11-09')).toBe(600); // segunda
    expect(workingMinutes(h, '2026-11-09', '2026-11-15')).toBe(5 * 600 + 300); // semana: seg–sáb, domingo fechado
    expect(workingMinutes(h, '2026-11-15', '2026-11-15')).toBe(0);
  });

  it('visão geral: faltas, cancelamentos, ticket, retorno e online', () => {
    const rows = [
      row({ clientId: 'c1' }),
      row({ clientId: 'c2', priceCents: 12000, source: 'ONLINE' }),
      row({ clientId: 'c3', status: 'FALTOU' }),
      row({ clientId: 'c4', status: 'CANCELADO' }),
      row({ clientId: 'c5', serviceId: 's2', serviceName: 'Barba', priceCents: 3000, memberId: 'm2', memberName: 'Beto' }),
    ];
    const o = buildOverview({ from: '2026-11-01', to: '2026-11-30', rows, availableByMember: { m1: 600, m2: 600 }, seenBefore: new Set(['c1']) });
    expect(o).toMatchObject({ total: 5, concluded: 3, noShows: 1, cancelled: 1, revenueCents: 23000, ticketCents: 7667, clientsServed: 3, returningClients: 1, newClients: 2 });
    expect(o.noShowPct).toBe(25); // 1 ÷ (3 + 1)
    expect(o.cancelPct).toBe(20);
    expect(o.returnPct).toBe(33.3);
    expect(o.onlineSharePct).toBe(25); // 1 de 4 não cancelados
    expect(o.services.map((s) => [s.name, s.count])).toEqual([['Corte', 2], ['Barba', 1]]);
    // Ocupação: m1 tem 3 reservas ocupando (2 concluídas + 1 falta) de 60 min = 180 de 600.
    const m1 = o.members.find((m) => m.id === 'm1')!;
    expect(m1).toMatchObject({ bookedMinutes: 180, availableMinutes: 600, occupancyPct: 30 });
    expect(o.occupancyPct).toBe(20); // (180 + 60) ÷ 1200
  });

  it('sem dados não inventa percentuais', () => {
    const o = buildOverview({ from: '2026-11-01', to: '2026-11-30', rows: [], availableByMember: {}, seenBefore: new Set() });
    expect(o).toMatchObject({ noShowPct: null, ticketCents: null, returnPct: null, occupancyPct: null, onlineSharePct: null });
  });

  it('aniversariantes dos próximos dias, virada de ano e 29/02', () => {
    const list = upcomingBirthdays(
      [
        { id: '1', name: 'Hoje', phone: null, birthDate: '1990-11-28' },
        { id: '2', name: 'Em 3 dias', phone: null, birthDate: '2015-12-01' },
        { id: '3', name: 'Virada', phone: null, birthDate: '1980-01-02' },
        { id: '4', name: 'Longe', phone: null, birthDate: '1980-07-20' },
        { id: '5', name: 'Bissexta', phone: null, birthDate: '2000-02-29' },
        { id: '6', name: 'Sem data', phone: null, birthDate: null },
      ],
      '2026-11-28',
      40,
    );
    expect(list.map((b) => [b.name, b.inDays])).toEqual([['Hoje', 0], ['Em 3 dias', 3], ['Virada', 35]]);
    expect(list[1].turns).toBe(11);
    expect(upcomingBirthdays([{ id: '5', name: 'Bissexta', phone: null, birthDate: '2000-02-29' }], '2027-02-20', 15)[0]).toMatchObject({ date: '2027-02-28', inDays: 8 });
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(29);
  });
});
