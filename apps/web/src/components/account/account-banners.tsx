'use client';

import { ChevronRight, MailWarning, Sparkles } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { resendVerification } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth';

/** Lembretes da conta na tela Hoje: confirmar e-mail e finalizar cadastro. */
export function AccountBanners() {
  const { user } = useAuth();
  const [sent, setSent] = React.useState(false);
  if (!user) return null;
  return (
    <>
      {!user.profileComplete ? (
        <Link href="/mais/perfil" className="flex animate-fade-up items-center gap-4 rounded-3xl bg-primary-soft p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card text-primary shadow-soft">
            <Sparkles className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold text-primary-soft-foreground">Finalize seu cadastro</span>
            <span className="block text-sm text-primary-soft-foreground/80">Nome completo, CPF e celular — 30 segundos.</span>
          </span>
          <ChevronRight className="size-5 text-primary-soft-foreground" />
        </Link>
      ) : null}
      {!user.emailVerified ? (
        <div className="flex animate-fade-up items-center gap-4 rounded-3xl bg-warning-soft p-4 text-warning-soft-foreground">
          <MailWarning className="size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold">Confirme seu e-mail</p>
            <p className="text-sm">Enviamos um link para {user.email}.</p>
          </div>
          <button
            type="button"
            disabled={sent}
            onClick={async () => {
              await resendVerification().catch(() => undefined);
              setSent(true);
              toast('Link reenviado 💌');
            }}
            className="shrink-0 text-sm font-bold underline disabled:opacity-60"
          >
            {sent ? 'Enviado' : 'Reenviar'}
          </button>
        </div>
      ) : null}
    </>
  );
}
