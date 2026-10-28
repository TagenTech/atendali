'use client';

import { WifiOff } from 'lucide-react';
import * as React from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Aviso discreto quando o celular fica sem internet. */
export function ConnectivityBanner() {
  const online = React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 pt-safe text-sm font-bold text-white">
      <WifiOff className="size-4" /> Sem internet — mostrando o que já estava carregado
    </div>
  );
}
