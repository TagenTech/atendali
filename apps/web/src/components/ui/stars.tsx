'use client';

import { MAX_RATING } from '@skedulei/contracts';
import { Star } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const STAR_LABELS = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];

/** Estrelas só de leitura (nota inteira ou média com casas decimais). */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`Nota ${String(value).replace('.', ',')} de ${MAX_RATING}`}>
      {Array.from({ length: MAX_RATING }, (_, i) => (
        <Star key={i} aria-hidden className={cn('size-4', i + 0.5 < value ? 'fill-warning text-warning' : 'text-border')} />
      ))}
    </span>
  );
}

/** Escolha da nota de 1 a 5 (grupo de rádio acessível, grande para o polegar). */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2 text-center">
      <div role="radiogroup" aria-label="Sua nota" className="flex justify-center gap-1.5">
        {Array.from({ length: MAX_RATING }, (_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'} — ${STAR_LABELS[i]}`}
              onClick={() => onChange(n)}
              className="grid size-12 place-items-center rounded-2xl transition-transform active:scale-90"
            >
              <Star className={cn('size-9 transition-colors', n <= value ? 'fill-warning text-warning' : 'text-border')} />
            </button>
          );
        })}
      </div>
      <p className="h-5 text-sm font-semibold text-muted-foreground" aria-live="polite">
        {value ? STAR_LABELS[value - 1] : ''}
      </p>
    </div>
  );
}
