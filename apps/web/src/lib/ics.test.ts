import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIcs, buildIcsMany, downloadIcs } from './ics';

const base = { uid: 'abc', title: 'Corte; com, vírgula', startsAt: '2026-03-10T13:00:00.000Z', endsAt: '2026-03-10T13:45:00Z' };

describe('ics', () => {
  afterEach(() => vi.useRealTimers());

  it('um evento: datas em UTC, texto escapado e lembrete de 2 h', () => {
    const ics = buildIcs({ ...base, location: 'Rua A, 1; sala 2', description: 'Linha 1\nLinha 2' });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc@skedulei');
    expect(ics).toContain('DTSTART:20260310T130000Z');
    expect(ics).toContain('DTEND:20260310T134500Z');
    expect(ics).toContain('SUMMARY:Corte\\; com\\, vírgula');
    expect(ics).toContain('LOCATION:Rua A\\, 1\\; sala 2');
    expect(ics).toContain('DESCRIPTION:Linha 1\\nLinha 2');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('sem local nem descrição, essas linhas não aparecem; vários eventos num calendário só', () => {
    const ics = buildIcsMany([base, { ...base, uid: 'def' }]);
    expect(ics).not.toContain('LOCATION');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    // O alarme repete o título, então "DESCRIPTION" só vem do alarme.
    expect(ics.match(/DESCRIPTION:/g)).toHaveLength(2);
  });

  it('downloadIcs cria o link, clica e libera a URL depois', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadIcs('reserva.ics', 'conteudo');
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });
});
