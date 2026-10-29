import { cn } from '@/lib/utils';

/**
 * Marca do Skedulei: três horários empilhados numa coluna de agenda (o do meio deslocado, como num encaixe) e o
 * ponto âmbar do "marcado". Fica nítida em 16 px e funciona em fundo escuro (o quadrado mantém a cor).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-12', className)} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#0f6b73" />
      <rect x="120" y="132" width="216" height="68" rx="34" fill="#fff" />
      <rect x="176" y="222" width="216" height="68" rx="34" fill="#fff" fillOpacity={0.72} />
      <rect x="120" y="312" width="150" height="68" rx="34" fill="#fff" fillOpacity={0.48} />
      <circle cx="352" cy="346" r="34" fill="#f2a63b" />
    </svg>
  );
}

/** Marca + nome, na altura de cabeçalhos. */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight', className)}>
      <LogoMark className={cn('size-8', markClassName)} />
      Skedulei
    </span>
  );
}
