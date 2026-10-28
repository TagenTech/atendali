import * as React from 'react';
import { cn } from '@/lib/utils';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
}

/** Filtro em pílula. Usado em linhas roláveis horizontalmente. */
export function Chip({ active, count, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-all active:scale-95',
        active
          ? 'border-transparent bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            'rounded-full px-1.5 text-xs tabular',
            active ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
