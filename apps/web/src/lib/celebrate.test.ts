import { afterEach, describe, expect, it, vi } from 'vitest';

const confetti = vi.hoisted(() => vi.fn());
vi.mock('canvas-confetti', () => ({ default: confetti }));

import { celebrate } from './celebrate';

const motion = (reduce: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: reduce }));

describe('celebrate', () => {
  afterEach(() => {
    vi.useRealTimers();
    confetti.mockClear();
  });

  it('solta confete em duas levas', async () => {
    vi.useFakeTimers();
    motion(false);
    await celebrate();
    expect(confetti).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(250);
    expect(confetti).toHaveBeenCalledTimes(2);
  });

  it('quem pediu para reduzir movimento não vê nada', async () => {
    motion(true);
    await celebrate();
    expect(confetti).not.toHaveBeenCalled();
  });
});
