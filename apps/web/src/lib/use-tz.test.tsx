import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ user: null as { timezone?: string } | null }));
vi.mock('./auth', () => ({ useAuth: () => ({ user: auth.user }) }));

import { useToday } from './use-today';
import { useTz } from './use-tz';

describe('useTz e useToday', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('usa o fuso da conta, ou o padrão do Brasil', () => {
    auth.user = { timezone: 'America/Manaus' };
    expect(renderHook(() => useTz()).result.current).toBe('America/Manaus');
    auth.user = null;
    expect(renderHook(() => useTz()).result.current).toBe('America/Sao_Paulo');
  });

  it('"hoje" respeita o fuso (virada de dia diferente de UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T02:00:00Z'));
    auth.user = { timezone: 'America/Sao_Paulo' };
    expect(renderHook(() => useToday()).result.current).toBe('2026-03-09');
    auth.user = { timezone: 'Asia/Tokyo' };
    expect(renderHook(() => useToday()).result.current).toBe('2026-03-10');
    auth.user = null;
    expect(renderHook(() => useToday()).result.current).toBe('2026-03-09');
  });
});
