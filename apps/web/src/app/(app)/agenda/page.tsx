'use client';

import { addDays, formatDateLong, formatDateShort, startOfWeek, todayIn, WEEKDAYS, WEEKDAYS_SHORT, zonedToUtc, type AppointmentDto } from '@skedulei/contracts';
import { ChevronLeft, ChevronRight, Hourglass, Lock, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AppointmentSheet } from '@/components/agenda/appointment-sheet';
import { BlockSheet } from '@/components/agenda/block-sheet';
import { DayGrid, type GridColumn, type MoveTarget } from '@/components/agenda/day-grid';
import { NewAppointmentSheet, type NewAppointmentPrefill } from '@/components/agenda/new-appointment-sheet';
import { WaitlistSheet } from '@/components/agenda/waitlist-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/lib/api/client';
import { capitalize } from '@/lib/format';
import { useOrg } from '@/lib/org';
import { useAgendaDay, useUpdateAppointment, useWaitlist } from '@/lib/queries/agenda';
import { useHydrated } from '@/lib/use-hydrated';
import { useIsDesktop } from '@/lib/use-media';
import { cn } from '@/lib/utils';

type View = 'dia' | 'semana';
const weekdayOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

function Agenda() {
  const { org } = useOrg();
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const desktop = useIsDesktop();
  const today = hydrated ? todayIn(org.timezone) : null;
  const dateParam = params.get('data');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const view: View = params.get('visao') === 'semana' ? 'semana' : 'dia';
  const start = date && view === 'semana' ? startOfWeek(date) : date;
  const { data: day, isLoading } = useAgendaDay(start, view === 'semana' ? 7 : 1);
  const { data: waitlist = [] } = useWaitlist();
  const update = useUpdateAppointment();

  const [picked, setPicked] = React.useState<string | null>(null);
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [creating, setCreating] = React.useState<(NewAppointmentPrefill & { key: number }) | null>(null);
  const [opened, setOpened] = React.useState<AppointmentDto | null>(null);
  const [blocking, setBlocking] = React.useState(false);
  const [waiting, setWaiting] = React.useState(false);

  const go = (d: string, v: View = view) => {
    const q = new URLSearchParams();
    if (d !== today) q.set('data', d);
    if (v === 'semana') q.set('visao', 'semana');
    router.replace(q.size ? `/agenda?${q}` : '/agenda', { scroll: false });
  };

  const pros = day?.professionals ?? [];
  const selected = picked && pros.some((p) => p.id === picked) ? picked : (pros[0]?.id ?? null);
  const openSlots = waitlist.filter((w) => w.openSlot).length;

  if (!date || !start) return <Skeleton className="m-5 h-96 rounded-3xl" />;

  // Dia: uma coluna por profissional (no celular, um por vez). Semana: 7 dias do profissional escolhido.
  const columns: GridColumn[] =
    view === 'dia'
      ? pros
          .filter((p) => desktop || p.id === selected)
          .map((p) => ({ key: p.id, label: p.name, color: p.color, date, memberId: p.id, hours: p.hours[weekdayOf(date)] ?? [] }))
      : (() => {
          const p = pros.find((x) => x.id === selected);
          return p
            ? Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => ({
                key: d,
                label: `${capitalize(WEEKDAYS_SHORT[weekdayOf(d)])} ${d.slice(8)}`,
                sublabel: p.name.split(' ')[0],
                color: p.color,
                date: d,
                memberId: p.id,
                hours: p.hours[weekdayOf(d)] ?? [],
                highlight: d === today,
              }))
            : [];
        })();

  const counts = new Map(pros.map((p) => [p.id, day?.appointments.filter((a) => a.memberId === p.id && a.status !== 'CANCELADO').length ?? 0]));
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const step = view === 'semana' ? 7 : 1;
  const title =
    view === 'semana'
      ? `${formatDateShort(start, false)} – ${formatDateShort(addDays(start, 6), false)}`
      : capitalize(formatDateLong(date, date.slice(0, 4) !== today?.slice(0, 4)));
  const subtitle = view === 'semana' ? 'Semana' : date === today ? 'Hoje' : capitalize(WEEKDAYS[weekdayOf(date)]);

  const move = async (a: AppointmentDto, to: MoveTarget) => {
    try {
      await update.mutateAsync({
        id: a.id,
        body: { startsAt: zonedToUtc(to.date, to.time, day!.timezone).toISOString(), memberId: to.memberId, durationMinutes: to.durationMinutes },
      });
      const endsAt = zonedToUtc(to.date, to.time, day!.timezone).getTime() + to.durationMinutes * 60_000;
      toast.success(`${a.clientName}: ${to.time}–${new Date(endsAt).toLocaleTimeString('pt-BR', { timeZone: day!.timezone, hour: '2-digit', minute: '2-digit' })} ✓`);
    } catch (err) {
      toast.error(errorText(err, 'Não foi possível remarcar'));
    }
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {subtitle} · {total} {total === 1 ? 'horário' : 'horários'}
          </p>
          <h1 className="truncate text-3xl font-black">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-2xl border-2 border-input bg-card p-0.5" role="group" aria-label="Visão">
            {(['dia', 'semana'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => go(date, v)}
                className={cn('h-9 rounded-xl px-3 text-sm font-bold capitalize', view === v ? 'bg-foreground text-background' : 'text-muted-foreground')}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-2xl border-2 border-input bg-card">
            <button type="button" aria-label={view === 'semana' ? 'Semana anterior' : 'Dia anterior'} onClick={() => go(addDays(date, -step))} className="grid size-10 place-items-center rounded-l-2xl hover:bg-muted">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => today && go(today)} className="h-10 px-3 text-sm font-bold hover:bg-muted">
              Hoje
            </button>
            <button type="button" aria-label={view === 'semana' ? 'Próxima semana' : 'Próximo dia'} onClick={() => go(addDays(date, step))} className="grid size-10 place-items-center rounded-r-2xl hover:bg-muted">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <input
            type="date"
            aria-label="Ir para o dia"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="h-11 rounded-2xl border-2 border-input bg-card px-3 text-sm"
          />
          <Button variant="outline" size="sm" className="relative h-11" onClick={() => setWaiting(true)}>
            <Hourglass /> Espera
            {waitlist.length ? (
              <span
                className={cn(
                  'grid min-w-5 place-items-center rounded-full px-1 text-xs font-black',
                  openSlots ? 'bg-success text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {openSlots || waitlist.length}
                <span className="sr-only">{openSlots ? ' com vaga aberta' : ' esperando'}</span>
              </span>
            ) : null}
          </Button>
          {day && view === 'dia' ? (
            <Button variant="outline" size="sm" className="h-11" onClick={() => setBlocking(true)}>
              <Lock /> Bloquear
            </Button>
          ) : null}
          <Button size="sm" className="h-11" onClick={() => setCreating({ date, memberId: selected ?? undefined, key: Date.now() })}>
            <Plus /> Agendar
          </Button>
        </div>
      </header>

      <div className="space-y-3 px-5">
        {pros.length > 1 && (!desktop || view === 'semana') ? (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
            {pros.map((p) => (
              <Chip key={p.id} active={p.id === selected} count={counts.get(p.id)} onClick={() => setPicked(p.id)}>
                {p.name.split(' ')[0]}
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-muted-foreground lg:block">Arraste um horário para remarcar; puxe a borda de baixo para mudar a duração.</p>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="accent-[var(--primary)]" />
            Mostrar cancelados
          </label>
        </div>

        {isLoading || !day ? (
          <Skeleton className="h-[32rem] rounded-3xl" />
        ) : !pros.length ? (
          <EmptyState emoji="🗓️" title="Ninguém atende ainda" description='Na Equipe, marque "Atende clientes" para quem tem agenda.' />
        ) : (
          <DayGrid
            day={day}
            columns={columns}
            showCancelled={showCancelled}
            today={today}
            onSlot={(col, time) => setCreating({ date: col.date, memberId: col.memberId, time, key: Date.now() })}
            onOpen={setOpened}
            onMove={desktop ? move : undefined}
          />
        )}
      </div>

      {creating ? <NewAppointmentSheet key={creating.key} open onOpenChange={(v) => !v && setCreating(null)} prefill={creating} /> : null}
      {opened ? <AppointmentSheet key={opened.id} appointment={opened} professionals={pros} onOpenChange={(v) => !v && setOpened(null)} /> : null}
      {blocking && day ? <BlockSheet day={day} onOpenChange={(v) => !v && setBlocking(false)} /> : null}
      {waiting ? (
        <WaitlistSheet
          professionals={pros}
          defaultDate={date}
          onOpenChange={setWaiting}
          onBook={(prefill) => {
            setWaiting(false);
            setCreating({ ...prefill, key: Date.now() });
          }}
        />
      ) : null}
    </>
  );
}

export default function AgendaPage() {
  return (
    <React.Suspense>
      <Agenda />
    </React.Suspense>
  );
}
