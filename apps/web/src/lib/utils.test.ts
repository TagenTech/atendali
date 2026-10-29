import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, haptic } from './utils';

describe('utils', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cn junta classes e resolve conflitos do Tailwind', () => {
    expect(cn('p-2', false && 'hidden', 'p-4')).toBe('p-4');
    expect(cn('a', ['b', { c: true, d: false }])).toBe('a b c');
  });

  it('haptic vibra onde há suporte e é silencioso onde não há', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    haptic();
    haptic([10, 20]);
    expect(vibrate).toHaveBeenNthCalledWith(1, 12);
    expect(vibrate).toHaveBeenNthCalledWith(2, [10, 20]);
    vi.stubGlobal('navigator', {});
    expect(() => haptic()).not.toThrow();
    vi.stubGlobal('navigator', undefined);
    expect(() => haptic()).not.toThrow();
  });
});
