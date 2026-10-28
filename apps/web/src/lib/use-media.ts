import * as React from 'react';

/** Acompanha uma media query (false no servidor e na hidratação). */
export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desktop = mesmo breakpoint `lg` do Tailwind (sidebar visível). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
