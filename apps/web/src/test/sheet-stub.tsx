import * as React from 'react';

export function useModalExpanded() {
  return false;
}

/** Troca o painel (vaul/portal) por um bloco simples: os testes olham o conteúdo, não a animação. */
export function Sheet({
  open,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  placement?: 'drawer' | 'center';
}) {
  if (!open) return null;
  return (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
}
