'use client';

import * as React from 'react';
import { useHydrated } from './use-hydrated';

const SW_URL = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?dev=1';

/** Registra o service worker. Em dev ele não faz cache (só push), para não atrapalhar o hot reload. */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' }).catch(() => null);
}

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') registerServiceWorker();
  }, []);
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'unsupported';

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Como o app pode ser instalado neste aparelho:
 * Android/desktop usam o prompt nativo; iPhone precisa do "Adicionar à Tela de Início".
 */
export function useInstallPrompt() {
  const hydrated = useHydrated();
  const [eventMode, setMode] = React.useState<InstallMode | null>(null);
  const deferred = React.useRef<BeforeInstallPromptEvent | null>(null);

  const mode: InstallMode = !hydrated
    ? 'unsupported'
    : isStandalone()
      ? 'installed'
      : (eventMode ?? (isIos() ? 'ios' : 'unsupported'));

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setMode('prompt');
    };
    const onInstalled = () => setMode('installed');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!deferred.current) return false;
    await deferred.current.prompt();
    const { outcome } = await deferred.current.userChoice;
    deferred.current = null;
    if (outcome === 'accepted') setMode('installed');
    return outcome === 'accepted';
  }, []);

  return { mode, install };
}
