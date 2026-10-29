import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFieldErrors } from './use-field-errors';
import { useHydrated } from './use-hydrated';
import { useIsDesktop, useMediaQuery } from './use-media';
import { useNow } from './use-now';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useFieldErrors', () => {
  it('fail guarda os erros, devolve false e foca o primeiro campo com problema', () => {
    const input = document.createElement('input');
    input.id = 'email';
    document.body.appendChild(input);
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
    const { result } = renderHook(() => useFieldErrors());
    let ok = true;
    act(() => {
      ok = result.current.fail({ nome: false, email: 'Informe o e-mail', senha: 'Muito curta', vazio: null, nada: undefined });
    });
    expect(ok).toBe(false);
    expect(result.current.errors).toEqual({ email: 'Informe o e-mail', senha: 'Muito curta' });
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it('sem erros devolve true e limpa; clear tira só o campo corrigido', () => {
    const { result } = renderHook(() => useFieldErrors());
    act(() => {
      result.current.fail({ a: 'Erro A', b: 'Erro B' });
    });
    act(() => result.current.clear('a'));
    expect(result.current.errors).toEqual({ b: 'Erro B' });
    const before = result.current.errors;
    act(() => result.current.clear('naoexiste'));
    expect(result.current.errors).toBe(before);
    let ok = false;
    act(() => {
      ok = result.current.fail({ a: false });
    });
    expect(ok).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('foco num campo que não existe na página não quebra', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
    const { result } = renderHook(() => useFieldErrors());
    expect(() => act(() => void result.current.fail({ fantasma: 'Erro' }))).not.toThrow();
  });
});

describe('useHydrated', () => {
  it('é true no navegador depois da hidratação', () => {
    expect(renderHook(() => useHydrated()).result.current).toBe(true);
  });
});

describe('useMediaQuery', () => {
  it('acompanha a media query e solta o ouvinte ao sair', () => {
    let matches = false;
    let listener: (() => void) | null = null;
    const remove = vi.fn();
    vi.stubGlobal('matchMedia', (q: string) => ({
      media: q,
      get matches() {
        return matches;
      },
      addEventListener: (_: string, cb: () => void) => (listener = cb),
      removeEventListener: remove,
    }));
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
    matches = true;
    act(() => listener?.());
    expect(result.current).toBe(true);
    expect(renderHook(() => useIsDesktop()).result.current).toBe(true);
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});

describe('useNow', () => {
  it('relógio compartilhado: atualiza a cada 30 s e para quando ninguém usa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(a.result.current).toBe(Date.now());
    expect(b.result.current).toBe(a.result.current);
    a.unmount();
    expect(clear).not.toHaveBeenCalled();
    b.unmount();
    expect(clear).toHaveBeenCalledTimes(1);
    // Voltando a usar, o relógio liga de novo.
    const c = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(c.result.current).toBe(Date.now());
  });
});
