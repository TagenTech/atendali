'use client';

import * as React from 'react';

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Relógio compartilhado (atualiza a cada 30s) — para contagens regressivas e "já passou". */
export function useNow(): number {
  return React.useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}
