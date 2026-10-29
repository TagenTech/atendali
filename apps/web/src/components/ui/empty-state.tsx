import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/** Convite a agir — sem ícone decorativo. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center lg:items-start lg:px-0 lg:py-12 lg:text-left', className)}>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
