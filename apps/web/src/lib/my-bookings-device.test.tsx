import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetBooking, rememberBooking, useDeviceBookings, type DeviceBooking } from './my-bookings-device';

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const booking = (token: string, days: number, slug = 'studio'): DeviceBooking => ({ token, slug, serviceName: 'Corte', patientName: 'Ana', startsAt: future(days), timezone: 'America/Sao_Paulo' });

describe('reservas guardadas neste aparelho', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('guarda, atualiza a lista na hora e ordena pelo horário', () => {
    const { result } = renderHook(() => useDeviceBookings('studio'));
    expect(result.current).toEqual([]);
    act(() => rememberBooking(booking('b', 5)));
    act(() => rememberBooking(booking('a', 2)));
    expect(result.current.map((b) => b.token)).toEqual(['a', 'b']);
    // Mesma reserva de novo não duplica.
    act(() => rememberBooking({ ...booking('a', 3) }));
    expect(result.current.map((b) => b.token)).toEqual(['a', 'b']);
  });

  it('só mostra as do negócio da página e esquece sob demanda', () => {
    const { result } = renderHook(() => useDeviceBookings('studio'));
    act(() => {
      rememberBooking(booking('a', 1));
      rememberBooking(booking('x', 1, 'outro'));
    });
    expect(result.current.map((b) => b.token)).toEqual(['a']);
    act(() => forgetBooking('a'));
    expect(result.current).toEqual([]);
    expect(JSON.parse(localStorage.getItem('skedulei_reservas')!)).toHaveLength(1);
  });

  it('reserva vencida ou registro estragado some na leitura; guarda no máximo 12', () => {
    localStorage.setItem('skedulei_reservas', JSON.stringify([booking('ok', 1), { ...booking('velha', 1), startsAt: '2020-01-01T00:00:00Z' }, { token: 5 }, null]));
    const { result } = renderHook(() => useDeviceBookings('studio'));
    expect(result.current.map((b) => b.token)).toEqual(['ok']);
    act(() => {
      for (let i = 0; i < 15; i++) rememberBooking(booking(`t${i}`, 1));
    });
    expect(JSON.parse(localStorage.getItem('skedulei_reservas')!)).toHaveLength(12);
  });

  it('JSON estragado devolve a última leitura boa; armazenamento negado não quebra a gravação', () => {
    const { result } = renderHook(() => useDeviceBookings('studio'));
    act(() => rememberBooking(booking('a', 1)));
    localStorage.setItem('skedulei_reservas', '{lixo');
    act(() => {
      window.dispatchEvent(new Event('storage'));
    });
    expect(result.current.map((b) => b.token)).toEqual(['a']);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('modo privado');
    });
    expect(() => rememberBooking(booking('z', 1))).not.toThrow();
  });
});
