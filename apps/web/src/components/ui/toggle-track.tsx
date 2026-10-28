import { cn } from '@/lib/utils';

/** Trilho + bolinha de um interruptor pequeno (o botão com role="switch" fica por fora). */
export function ToggleTrack({ on, className }: { on: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('relative block h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-input', className)}>
      <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]', on ? 'left-[1.125rem]' : 'left-0.5')} />
    </span>
  );
}
