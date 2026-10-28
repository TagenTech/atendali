'use client';

import * as React from 'react';
import { Input, type InputProps } from './input';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onChange: (cents: number | null) => void;
}

/**
 * Valor em centavos com máscara "de caixa": cada dígito entra pela direita
 * (2 → 0,02 → 0,28 → 2,80 → 28,00 → 280,00). Teclado numérico no celular.
 */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      icon={<span className="font-display text-base font-bold">R$</span>}
      value={value ? fmt.format(value / 100) : ''}
      placeholder="0,00"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
        onChange(digits ? Number(digits) : null);
      }}
      className="tabular"
    />
  );
}
