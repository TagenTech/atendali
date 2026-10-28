'use client';

import * as React from 'react';
import { Drawer } from 'vaul';
import { useIsDesktop } from '@/lib/use-media';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Celular: bottom sheet com gesto de arrastar para fechar.
 * Desktop: painel lateral à direita — a tela de trás continua visível (lista, agenda).
 */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  const desktop = useIsDesktop();
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={desktop ? 'right' : 'bottom'}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[#1b1430]/40 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            'fixed z-50 flex flex-col bg-card outline-none',
            desktop
              ? 'inset-y-0 right-0 w-[30rem] max-w-[92vw] border-l border-border shadow-soft'
              : 'inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-lg rounded-t-[2rem] pb-safe',
            className,
          )}
        >
          {desktop ? null : <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" aria-hidden />}
          <div className={cn('px-6 pb-2', desktop ? 'pt-6' : 'pt-4')}>
            <Drawer.Title className="font-display text-xl font-extrabold">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1 text-muted-foreground">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
