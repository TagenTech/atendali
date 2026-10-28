'use client';

import { Input, type InputProps } from './input';

/** Percentual com até 2 casas, guardado em pontos-base (bps): 3,49% → 349. Vazio = null. */
export function PercentInput({
  value,
  onChange,
  max = 100,
  ...props
}: Omit<InputProps, 'value' | 'onChange' | 'type'> & { value: number | null; onChange: (bps: number | null) => void; max?: number }) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step={0.01}
      value={value === null ? '' : value / 100}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Math.min(max * 100, Math.max(0, Math.round(Number(v) * 100))));
      }}
      trailing={<span className="text-sm text-muted-foreground">%</span>}
    />
  );
}
