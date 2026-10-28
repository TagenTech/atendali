import { anyOverlap, planSequences } from './agenda';

const iso = (hhmm: string) => `2026-11-10T${hhmm}:00.000Z`;
const grid = (members: Record<string, string[]>) => members;

describe('procedimentos em sequência', () => {
  const services = [
    { serviceId: 'corte', durationMinutes: 40 },
    { serviceId: 'barba', durationMinutes: 20 },
  ];

  it('encaixa um logo após o outro, mantendo quem atendeu se estiver livre', () => {
    const plans = planSequences({
      services,
      offered: [grid({ [iso('10:00')]: ['ana', 'beto'] }), grid({ [iso('10:40')]: ['beto', 'ana'] })],
      firstStarts: [iso('10:00')],
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].items.map((i) => [i.serviceId, i.memberId, i.startsAt, i.endsAt])).toEqual([
      ['corte', 'ana', iso('10:00'), iso('10:40')],
      ['barba', 'ana', iso('10:40'), iso('11:00')],
    ]);
  });

  it('troca de profissional quando quem atendeu não está livre; descarta início sem encaixe', () => {
    const plans = planSequences({
      services,
      offered: [grid({ [iso('10:00')]: ['ana'], [iso('10:15')]: ['ana'] }), grid({ [iso('10:40')]: ['beto'] })],
      firstStarts: [iso('10:00'), iso('10:15')],
    });
    expect(plans.map((p) => p.startsAt)).toEqual([iso('10:00')]);
    expect(plans[0].items[1].memberId).toBe('beto');
  });

  it('sem nenhum encaixe devolve vazio', () => {
    expect(planSequences({ services, offered: [grid({ [iso('10:00')]: ['ana'] }), grid({})], firstStarts: [iso('10:00')] })).toEqual([]);
  });

  it('detecta sobreposição entre horários escolhidos (encostar pode)', () => {
    expect(anyOverlap([{ startsAt: iso('10:00'), endsAt: iso('10:40') }, { startsAt: iso('10:40'), endsAt: iso('11:00') }])).toBe(false);
    expect(anyOverlap([{ startsAt: iso('10:30'), endsAt: iso('11:10') }, { startsAt: iso('10:00'), endsAt: iso('10:40') }])).toBe(true);
    expect(anyOverlap([])).toBe(false);
  });
});
