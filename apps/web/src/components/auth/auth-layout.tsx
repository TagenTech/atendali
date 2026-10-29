import * as React from 'react';
import { LogoMark, Wordmark } from '@/components/brand/logo';

/**
 * Telas de entrada. No celular: marca no topo e formulário. No desktop (lg): painel de marca à esquerda
 * (o que o Skedulei entrega, em frases curtas e reais) e formulário à direita.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col pt-safe lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink-deep p-12 text-white lg:flex" aria-hidden>
        <Wordmark className="text-white" markClassName="size-9" />
        <div className="max-w-md">
          <p className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">Marcado.<br />Confirmado.<br />Pago.</p>
          <p className="mt-6 text-lg leading-relaxed text-white/75">
            A agenda, o caixa e o financeiro do seu negócio no mesmo lugar — e o cliente marca o horário sozinho.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex items-center gap-3"><span className="h-px w-8 bg-[#c980eb]" />Agenda por profissional, no celular e no computador</li>
          <li className="flex items-center gap-3"><span className="h-px w-8 bg-[#c980eb]" />Página própria de agendamento online</li>
          <li className="flex items-center gap-3"><span className="h-px w-8 bg-[#c980eb]" />Comanda, caixa, comissões e DRE</li>
        </ul>
      </aside>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10 lg:max-w-md">
        <div className="mb-8 text-center lg:text-left">
          <LogoMark className="mx-auto mb-4 size-14 lg:hidden" />
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div>{children}</div>
      </div>
    </main>
  );
}
