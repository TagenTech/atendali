'use client';

import type { TvEntryDto } from '@skedulei/contracts';
import { Maximize2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useNow } from '@/lib/use-now';
import { useTvBoard } from '@/lib/queries/retention';
import { timeOf } from '@/lib/format';
import { cn } from '@/lib/utils';

function Column({ title, empty, entries, tz, tone }: { title: string; empty: string; entries: TvEntryDto[]; tz: string; tone: string }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-[2rem] bg-white/5 p-6">
      <h2 className={cn('mb-4 text-lg font-extrabold uppercase tracking-widest', tone)}>{title}</h2>
      {entries.length ? (
        <ul className="space-y-3">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-baseline gap-4">
              <span className="w-16 shrink-0 font-display text-xl font-bold tabular text-white/60">{timeOf(e.startsAt, tz)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-2xl font-extrabold lg:text-3xl">{e.name}</span>
                <span className="block truncate text-base text-white/60">com {e.professionalName}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-lg text-white/40">{empty}</p>
      )}
    </section>
  );
}

/** Painel para a TV da recepção: quem foi chamado, quem aguarda e os próximos. Só primeiro nome + inicial. */
export default function TvPage() {
  const { data } = useTvBoard();
  const tick = useNow();
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

  if (!data) return <div className="grid min-h-dvh place-items-center bg-[#150f26] text-white/60" aria-busy="true">Carregando…</div>;

  // O servidor já descarta chamadas com mais de 2 minutos; o painel consulta de 5 em 5 segundos.
  const clock = timeOf(new Date(tick || data.now).toISOString(), data.timezone);
  const calling = data.calling;

  return (
    <div className="min-h-dvh bg-[#150f26] p-6 text-white lg:p-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate font-display text-3xl font-black lg:text-4xl">{data.organizationName}</h1>
        <div className="flex items-center gap-3">
          <span className="font-display text-4xl font-black tabular lg:text-5xl" aria-label="Hora">
            {clock}
          </span>
          <button type="button" onClick={toggleFullscreen} aria-label="Tela cheia" className="grid size-11 place-items-center rounded-2xl bg-white/10 hover:bg-white/20">
            <Maximize2 className="size-5" />
          </button>
          <Link href="/inicio" className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
            Sair do painel
          </Link>
        </div>
      </header>

      <section aria-label="Chamando agora" aria-live="assertive" className={cn('mb-6 rounded-[2rem] p-8 text-center transition-colors', calling.length ? 'animate-pulse bg-[#8f7cf8]' : 'bg-white/5')}>
        {calling.length ? (
          <>
            <p className="text-lg font-bold uppercase tracking-widest text-white/80">Chamando agora</p>
            {calling.slice(0, 3).map((e) => (
              <p key={e.id} className="mt-2 font-display text-5xl font-black lg:text-7xl">
                {e.name} <span className="text-3xl font-bold text-white/80 lg:text-4xl">→ {e.professionalName}</span>
              </p>
            ))}
          </>
        ) : (
          <p className="text-2xl font-semibold text-white/40">Bem-vindo(a)! Em breve chamaremos você.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Column title="Aguardando" empty="Ninguém aguardando." entries={data.waiting} tz={data.timezone} tone="text-[#ffcf5c]" />
        <Column title="Em atendimento" empty="—" entries={data.inService} tz={data.timezone} tone="text-[#6ee7a8]" />
        <Column title="Próximos" empty="Sem mais horários hoje." entries={data.next} tz={data.timezone} tone="text-[#9fb4ff]" />
      </div>
    </div>
  );
}
