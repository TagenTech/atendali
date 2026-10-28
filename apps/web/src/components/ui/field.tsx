import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Rótulo + controle + mensagem de erro/ajuda, com ids ligados para leitores de tela. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <LabelPrimitive.Root htmlFor={htmlFor} className="block pl-1 text-sm font-semibold text-foreground">
        {label}
      </LabelPrimitive.Root>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
            'aria-describedby': describedBy,
          })
        : children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="pl-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="pl-1 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
