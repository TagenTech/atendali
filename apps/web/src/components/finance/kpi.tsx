import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'danger';
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-display text-lg font-extrabold tabular sm:text-xl',
          tone === 'warn' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Números no livro-caixa: uma superfície, linhas finas, sem card por indicador. */
export function KpiStrip({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border',
        cols === 3 && 'sm:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        cols === 6 && 'sm:grid-cols-3 2xl:grid-cols-6',
      )}
    >
      {children}
    </div>
  );
}
