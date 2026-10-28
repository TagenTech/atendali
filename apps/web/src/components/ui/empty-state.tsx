import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: 'primary' | 'pink' | 'success' | 'warning' | 'sky' | 'peach';
  className?: string;
}

const tones = {
  primary: 'bg-primary-soft',
  pink: 'bg-pink-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  sky: 'bg-sky-soft',
  peach: 'bg-peach-soft',
};

export function EmptyState({ emoji, title, description, action, tone = 'primary', className }: EmptyStateProps) {
  return (
    <div className={cn('flex animate-fade-up flex-col items-center px-6 py-10 text-center', className)}>
      <div
        className={cn('mb-5 grid size-24 place-items-center rounded-[2rem] text-5xl shadow-soft', tones[tone])}
        aria-hidden
      >
        {emoji}
      </div>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-xs text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
