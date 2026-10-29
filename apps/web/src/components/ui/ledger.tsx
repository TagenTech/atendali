import * as React from 'react';
import { cn } from '@/lib/utils';

/** Superfície de livro: uma borda, linhas finas, sem card por linha. */
export function Ledger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-3xl border border-border bg-card', className)}>{children}</div>;
}

export function LedgerTable({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <table className="w-full text-left">
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  );
}

export const theadClass = 'border-b border-border text-xs font-semibold text-muted-foreground';
export const thClass = 'px-5 py-2.5 font-semibold';
export const tdClass = 'px-5 py-3';
