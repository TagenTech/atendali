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
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const go = (d: string, v: View = view) => {
    const q = new URLSearchParams();
    if (d !== today) q.set('data', d);
    if (v === 'semana') q.set('visao', 'semana');
    router.replace(q.size ? `/agenda?${q}` : '/agenda', { scroll: false });
  };

  const pros = day?.professionals ?? [];
  const selected = picked && pros.some((p) => p.id === picked) ? picked : (pros[0]?.id ?? null);
  const openSlots = waitlist.filter((w) => w.openSlot).length;

  if (!date || !start) return <Skeleton className="mx-6 mt-5 h-96 rounded-3xl lg:mx-8" />;

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

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  };

  return (
    <>
    <div className="mx-auto w-full max-w-7xl pb-8 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
      <header className="space-y-3 px-6 pb-3 lg:px-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={view === 'semana' ? 'Semana anterior' : 'Dia anterior'}
            onClick={() => go(addDays(date, -step))}
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>

          <button
            type="button"
            onClick={openDatePicker}
            className="min-w-0 flex-1 rounded-2xl px-1 py-1 text-left hover:bg-muted/60"
            aria-label="Ir para o dia"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {subtitle} · {total} {total === 1 ? 'horário' : 'horários'}
            </p>
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            aria-hidden
            tabIndex={-1}
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="sr-only"
          />

          <button
            type="button"
            aria-label={view === 'semana' ? 'Próxima semana' : 'Próximo dia'}
            onClick={() => go(addDays(date, step))}
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-10 items-center rounded-2xl border border-input bg-card p-0.5" role="group" aria-label="Visão">
            {(['dia', 'semana'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => go(date, v)}
                className={cn(
                  'h-full rounded-xl px-3 text-sm font-bold capitalize',
                  view === v ? 'bg-foreground text-background' : 'text-muted-foreground',
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {today && date !== today ? (
            <button
              type="button"
              onClick={() => go(today)}
              className="h-10 rounded-2xl px-3 text-sm font-bold text-primary hover:bg-primary-soft"
            >
              Hoje
            </button>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" className="relative h-10 gap-1.5 px-2.5" onClick={() => setWaiting(true)}>
              <Hourglass />
              <span className="max-sm:sr-only">Espera</span>
              {waitlist.length ? (
                <span
                  className={cn(
                    'grid min-w-5 place-items-center rounded-full px-1 text-xs font-extrabold',
                    openSlots ? 'bg-success text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {openSlots || waitlist.length}
                  <span className="sr-only">{openSlots ? ' com vaga aberta' : ' esperando'}</span>
                </span>
              ) : null}
            </Button>
            {day && view === 'dia' ? (
              <Button variant="ghost" size="sm" className="h-10 px-2.5" onClick={() => setBlocking(true)}>
                <Lock /> <span className="max-sm:sr-only">Bloquear</span>
              </Button>
            ) : null}
            <Button
              size="sm"
              className="h-10 shrink-0 px-3"
              onClick={() => setCreating({ date, memberId: selected ?? undefined, key: Date.now() })}
            >
              <Plus /> Agendar
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-6 lg:px-0">
          {pros.length > 1 && (!desktop || view === 'semana') ? (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none">
              {pros.map((p) => (
                <Chip key={p.id} active={p.id === selected} count={counts.get(p.id)} onClick={() => setPicked(p.id)}>
                  {p.name.split(' ')[0]}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="hidden min-w-0 flex-1 text-xs text-muted-foreground lg:block">
              Arraste um horário para remarcar; puxe a borda de baixo para mudar a duração.
            </p>
          )}
          <Chip active={showCancelled} onClick={() => setShowCancelled((v) => !v)} className="shrink-0">
            Cancelados
          </Chip>
        </div>

        <div className="lg:px-0">
          {isLoading || !day ? (
            <Skeleton className="mx-6 h-[32rem] rounded-3xl lg:mx-0" />
          ) : !pros.length ? (
            <div className="px-6 lg:px-0">
              <EmptyState title="Ninguém atende ainda" description='Na Equipe, marque "Atende clientes" para quem tem agenda.' />
            </div>
          ) : (
            <DayGrid
              day={day}
              columns={columns}
              showCancelled={showCancelled}
              today={today}
              onSlot={(col, time) => setCreating({ date: col.date, memberId: col.memberId, time, key: Date.now() })}
              onOpen={setOpened}
              onMove={desktop ? move : undefined}
              className="rounded-none border-x-0 sm:mx-6 sm:rounded-3xl sm:border lg:mx-0"
            />
          )}
        </div>
      </div>
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
