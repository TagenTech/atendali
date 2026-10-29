'use client';

import { Maximize2, Minimize2, X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/lib/use-media';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** `drawer` (padrão): celular embaixo, desktop à direita. `center`: modal no meio da tela. */
  placement?: 'drawer' | 'center';
}

const EXPAND_KEY = 'skedulei_modal_expanded';
const expandListeners = new Set<() => void>();

function readExpanded(): boolean | null {
  try {
    const v = localStorage.getItem(EXPAND_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch {
    return null;
  }
}

function subscribeExpanded(cb: () => void) {
  expandListeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    expandListeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function writeExpanded(next: boolean) {
  try {
    localStorage.setItem(EXPAND_KEY, next ? '1' : '0');
  } catch {
    /* modo privado: vale só nesta aba */
  }
  expandListeners.forEach((l) => l());
}

const ExpandedCtx = React.createContext(false);

/** O modal do centro está expandido (prontuário em tela larga no computador). */
export function useModalExpanded() {
  return React.useContext(ExpandedCtx);
}

function useExpandedPreference() {
  const stored = React.useSyncExternalStore(subscribeExpanded, readExpanded, () => null);
  const desktop = useIsDesktop();
  return stored ?? desktop;
}

function CenterModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: Omit<SheetProps, 'placement'>) {
  const titleId = React.useId();
  const descId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const expanded = useExpandedPreference();

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <ExpandedCtx.Provider value={expanded}>
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', expanded ? 'p-3 lg:p-5' : 'p-4 sm:p-6')}>
        <button
          type="button"
          className="absolute inset-0 bg-[#1b1430]/40 backdrop-blur-[2px]"
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'relative z-10 flex flex-col rounded-3xl border border-border bg-card outline-none',
            expanded
              ? 'h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl lg:h-[calc(100dvh-2.5rem)] lg:w-[min(72rem,calc(100vw-2.5rem))]'
              : 'max-h-[min(92dvh,52rem)] w-full max-w-xl animate-fade-up',
            className,
          )}
        >
          <div className="flex items-start gap-3 px-6 pb-2 pt-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-xl font-extrabold">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9"
                aria-label={expanded ? 'Reduzir' : 'Expandir'}
                aria-pressed={expanded}
                onClick={() => writeExpanded(!expanded)}
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-9" aria-label="Fechar" onClick={() => onOpenChange(false)}>
                <X />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </ExpandedCtx.Provider>,
    document.body,
  );
}

/**
 * Celular: bottom sheet com gesto de arrastar para fechar.
 * Desktop: painel lateral à direita — a tela de trás continua visível (lista, agenda).
 * `placement="center"`: modal no meio; no computador abre amplo, com botão para reduzir.
 */
export function Sheet({ open, onOpenChange, title, description, children, className, placement = 'drawer' }: SheetProps) {
  const desktop = useIsDesktop();
  if (placement === 'center') {
    return (
      <CenterModal open={open} onOpenChange={onOpenChange} title={title} description={description} className={className}>
        {children}
      </CenterModal>
    );
  }
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
