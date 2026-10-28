'use client';

import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';

export function PasswordInput(props: Omit<InputProps, 'type' | 'icon' | 'trailing'>) {
  const [show, setShow] = React.useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      icon={<LockKeyhole />}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="-mr-2 grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted [&_svg]:size-5"
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      }
    />
  );
}

/** Força simples: tamanho + variedade. Só orienta, não bloqueia além do mínimo. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) s++;
  const score = Math.min(3, s) as 0 | 1 | 2 | 3;
  return { score, label: ['Curta demais', 'Ok', 'Boa', 'Forte 💪'][score] };
}
