'use client';

import { ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Volta para a tela anterior; se o app foi aberto direto aqui, vai para `fallback`. */
export function useBack(fallback: string) {
  const router = useRouter();
  return React.useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

export function FormTopBar({
  onBack,
  title,
  variant = 'back',
  children,
}: {
  onBack: () => void;
  title?: string;
  variant?: 'back' | 'close';
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 bg-background/90 px-3 pb-2 pt-3 backdrop-blur-lg">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={variant === 'close' ? 'Fechar' : 'Voltar'}
          className="grid size-11 shrink-0 place-items-center rounded-2xl text-foreground hover:bg-muted"
        >
          {variant === 'close' ? <X className="size-6" /> : <ArrowLeft className="size-6" />}
        </button>
        {title ? <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">{title}</h1> : null}
        {children}
      </div>
    </div>
  );
}

/** Barra fixa no rodapé com as ações do formulário. */
export function StickyActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="sticky bottom-0 z-30 mt-8 border-t border-border bg-[var(--nav-bg)] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
      <div className={cn('flex gap-3', className)}>{children}</div>
    </div>
  );
}
