import * as React from 'react';

const noop = () => () => {};

/** `false` no servidor e na hidratação, `true` depois — para ler APIs do navegador sem divergir do HTML. */
export function useHydrated() {
  return React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
