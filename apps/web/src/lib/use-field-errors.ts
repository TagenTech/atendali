import * as React from 'react';

/**
 * Erros de formulário por campo (a chave é o `id` do campo): aparecem embaixo dele, em vermelho, e o foco vai para o primeiro.
 * `fail({...})` devolve `false` quando há erro, para usar como `if (!fail({...})) return;`.
 */
export function useFieldErrors() {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const fail = React.useCallback((found: Record<string, string | false | null | undefined>) => {
    const next: Record<string, string> = {};
    for (const [id, msg] of Object.entries(found)) if (msg) next[id] = msg;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return Object.keys(next).length === 0;
  }, []);
  const clear = React.useCallback((id: string) => setErrors((e) => (id in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)) : e)), []);
  return { errors, fail, clear };
}
