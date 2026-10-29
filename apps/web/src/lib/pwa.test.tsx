import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIos, isStandalone, registerServiceWorker, ServiceWorkerRegister, useInstallPrompt } from './pwa';

const standalone = (on: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: on }));
const setNavigator = (props: Record<string, unknown>) => vi.stubGlobal('navigator', { userAgent: '', platform: '', maxTouchPoints: 0, ...props });

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('service worker', () => {
  it('registra com escopo raiz; falha vira null; sem suporte não faz nada', async () => {
    const register = vi.fn(async () => ({ scope: '/' }));
    setNavigator({ serviceWorker: { register } });
    expect(await registerServiceWorker()).toEqual({ scope: '/' });
    expect(register).toHaveBeenCalledWith(expect.stringContaining('/sw.js'), { scope: '/', updateViaCache: 'none' });
    register.mockRejectedValueOnce(new Error('bloqueado'));
    expect(await registerServiceWorker()).toBeNull();
    setNavigator({});
    expect(await registerServiceWorker()).toBeNull();
  });

  it('o componente só registra em produção', () => {
    const register = vi.fn(async () => ({}));
    setNavigator({ serviceWorker: { register } });
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
    cleanup();
    vi.stubEnv('NODE_ENV', 'production');
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe('detecção do aparelho', () => {
  it('isStandalone: modo app ou iOS "tela de início"', () => {
    setNavigator({});
    standalone(true);
    expect(isStandalone()).toBe(true);
    standalone(false);
    expect(isStandalone()).toBe(false);
    setNavigator({ standalone: true });
    expect(isStandalone()).toBe(true);
  });

  it('isIos: iPhone, iPad, ou Mac com toque (iPadOS)', () => {
    setNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17)' });
    expect(isIos()).toBe(true);
    setNavigator({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 });
    expect(isIos()).toBe(true);
    setNavigator({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 });
    expect(isIos()).toBe(false);
    setNavigator({ userAgent: 'Android' });
    expect(isIos()).toBe(false);
  });
});

describe('useInstallPrompt', () => {
  it('já instalado, iPhone e sem suporte', () => {
    setNavigator({});
    standalone(true);
    expect(renderHook(() => useInstallPrompt()).result.current.mode).toBe('installed');
    standalone(false);
    setNavigator({ userAgent: 'iPhone' });
    expect(renderHook(() => useInstallPrompt()).result.current.mode).toBe('ios');
    setNavigator({ userAgent: 'Firefox' });
    expect(renderHook(() => useInstallPrompt()).result.current.mode).toBe('unsupported');
  });

  it('Android: guarda o convite do navegador e instala quando a pessoa aceita', async () => {
    setNavigator({});
    standalone(false);
    const { result } = renderHook(() => useInstallPrompt());
    expect(await result.current.install()).toBe(false);

    const prompt = vi.fn(async () => undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.mode).toBe('prompt');
    let accepted = false;
    await act(async () => {
      accepted = await result.current.install();
    });
    expect(accepted).toBe(true);
    expect(prompt).toHaveBeenCalled();
    expect(result.current.mode).toBe('installed');
  });

  it('recusar o convite mantém "prompt"; o evento appinstalled marca como instalado', async () => {
    setNavigator({});
    standalone(false);
    const { result } = renderHook(() => useInstallPrompt());
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'dismissed' as const }) });
    act(() => {
      window.dispatchEvent(event);
    });
    await act(async () => {
      expect(await result.current.install()).toBe(false);
    });
    expect(result.current.mode).toBe('prompt');
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.mode).toBe('installed');
  });
});
