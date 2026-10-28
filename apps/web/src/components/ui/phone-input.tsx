'use client';

import { formatPhone, normalizePhone, PHONE_MAX_LENGTH } from '@skedulei/contracts';
import * as React from 'react';
import { Input, type InputProps } from './input';

interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string | null | undefined;
  /** Devolve só os dígitos (Brasil) ou o número com "+" e DDI (outros países). */
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(11) 98765-4321"
      value={formatPhone(value ?? '')}
      onChange={(e) => {
        const n = normalizePhone(e.target.value);
        onChange(n.startsWith('+') ? n.slice(0, PHONE_MAX_LENGTH) : n.slice(0, 11));
      }}
    />
  );
}
