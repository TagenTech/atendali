import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

export function Input({ className, icon, trailing, invalid, ...props }: InputProps) {
  return (
    <div
      className={cn(
        'flex h-13 items-center gap-2.5 rounded-2xl border border-input bg-card px-4 transition-colors focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-soft',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger-soft',
        className,
      )}
    >
      {icon ? <span className="text-muted-foreground [&_svg]:size-5">{icon}</span> : null}
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
        aria-invalid={invalid || undefined}
        {...props}
      />
      {trailing}
    </div>
  );
}
