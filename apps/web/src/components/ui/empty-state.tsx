import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  /** Dentro de uma página com outros blocos: caixa tracejada e compacta, em vez de tela vazia. */
  inline?: boolean;
}

/** Convite a agir — sem ícone decorativo. */
export function EmptyState({ title, description, action, className, inline }: EmptyStateProps) {
  return (
    <div
      className={cn(
        inline
          ? 'flex flex-col items-center rounded-3xl border border-dashed border-input px-6 py-7 text-center'
          : 'flex flex-col items-center px-6 py-10 text-center lg:items-start lg:px-0 lg:py-12 lg:text-left',
        className,
      )}
    >
      <h2 className={inline ? 'text-base font-extrabold' : 'text-xl font-extrabold'}>{title}</h2>
      <p className={cn('mt-1.5 max-w-md text-muted-foreground', inline && 'text-sm')}>{description}</p>
      {action ? <div className={inline ? 'mt-4' : 'mt-6'}>{action}</div> : null}
    </div>
  );
}
