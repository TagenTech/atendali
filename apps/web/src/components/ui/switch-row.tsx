'use client';

import { cn, haptic } from '@/lib/utils';

/** Linha com texto e interruptor — toda a linha é clicável. */
export function SwitchRow({
  checked,
  onCheckedChange,
  title,
  description,
  id,
  disabled,
  badge,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  title: string;
  description?: string;
  id: string;
  /** Opção que ainda não pode ser ligada (ex.: recurso futuro). */
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        haptic(8);
        onCheckedChange(!checked);
      }}
      className={cn('flex w-full items-center gap-4 rounded-2xl border border-input bg-card p-4 text-left transition-colors', disabled && 'cursor-not-allowed opacity-60')}
    >
      <span className="flex-1">
        <span className="block font-semibold">
          {title}
          {badge ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-bold text-muted-foreground">{badge}</span> : null}
        </span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  );
}
