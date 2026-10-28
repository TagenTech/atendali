'use client';

import { cn, haptic } from '@/lib/utils';

/** Linha com texto e interruptor — toda a linha é clicável. */
export function SwitchRow({
  checked,
  onCheckedChange,
  title,
  description,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  title: string;
  description?: string;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => {
        haptic(8);
        onCheckedChange(!checked);
      }}
      className="flex w-full items-center gap-4 rounded-2xl border-2 border-input bg-card p-4 text-left transition-colors"
    >
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
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
