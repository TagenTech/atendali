import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full resize-y rounded-2xl border-2 border-input bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary-soft',
        invalid && 'border-danger',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
