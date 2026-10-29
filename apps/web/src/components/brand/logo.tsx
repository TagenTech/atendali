import { cn } from '@/lib/utils';

/**
 * Marca do Skedulei: prancheta com relógio e check em roxo/lavanda (public/logo.png). O tile creme mantém a
 * logo legível em fundo escuro e segue o formato do ícone do app.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="" className={cn('size-12 rounded-[24%] bg-[#fbf3e8] object-contain p-[4%]', className)} />
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
