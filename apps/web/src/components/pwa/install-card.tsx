'use client';

import { Share, SquarePlus, Smartphone, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { useInstallPrompt } from '@/lib/pwa';
import { useHydrated } from '@/lib/use-hydrated';

const DISMISS_KEY = 'skedulei_install_dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Convite para instalar o app na tela inicial — necessário para os lembretes no iPhone. */
export function InstallCard({ dismissible = true }: { dismissible?: boolean }) {
  const { mode, install } = useInstallPrompt();
  const [iosHelp, setIosHelp] = React.useState(false);
  const hydrated = useHydrated();
  const [dismissedNow, setDismissed] = React.useState(false);
  const dismissed = dismissedNow || (dismissible && hydrated && readDismissed());

  if (dismissed || mode === 'installed' || mode === 'unsupported') return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignora */
    }
  };

  return (
    <>
      <div className="relative flex animate-fade-up items-center gap-4 rounded-3xl bg-pink-soft p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card text-pink shadow-soft">
          <Smartphone className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold text-pink-soft-foreground">Instale o Skedulei</p>
          <p className="text-sm text-pink-soft-foreground/80">Abre como app e recebe os avisos da agenda.</p>
        </div>
        <Button
          size="sm"
          className="bg-pink text-white shadow-none hover:bg-pink hover:brightness-95"
          onClick={() => (mode === 'ios' ? setIosHelp(true) : install())}
        >
          Instalar
        </Button>
        {dismissible ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Agora não"
            className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-soft"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <Sheet open={iosHelp} onOpenChange={setIosHelp} title="Instalar no iPhone" description="Leva 10 segundos ✨">
        <ol className="space-y-4">
          <li className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--stu-ceu)] text-[var(--stu-ceu-fg)]">
              <Share className="size-5" />
            </span>
            <p>
              No Safari, toque em <strong>Compartilhar</strong> na barra de baixo.
            </p>
          </li>
          <li className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <SquarePlus className="size-5" />
            </span>
            <p>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </p>
          </li>
          <li className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pink-soft text-xl">💜</span>
            <p>
              Toque em <strong>Adicionar</strong> e abra o Skedulei pelo ícone.
            </p>
          </li>
        </ol>
        <Button block className="mt-6" onClick={() => setIosHelp(false)}>
          Entendi
        </Button>
      </Sheet>
    </>
  );
}
