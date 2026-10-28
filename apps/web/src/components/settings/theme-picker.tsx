'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import { useHydrated } from '@/lib/use-hydrated';
import { cn, haptic } from '@/lib/utils';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Automático', icon: Monitor },
];

export function ThemePicker() {
  const hydrated = useHydrated();
  const [picked, setTheme] = React.useState<Theme | null>(null);
  const theme = picked ?? (hydrated ? getStoredTheme() : 'light');

  return (
    <div role="radiogroup" aria-label="Aparência" className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              haptic(8);
              setTheme(value);
              applyTheme(value);
            }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl py-2.5 text-sm font-semibold transition-all',
              active ? 'bg-card text-primary-soft-foreground shadow-soft' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
