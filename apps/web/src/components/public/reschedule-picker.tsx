'use client';

import { addDays, ONLINE_BOOKING, todayIn, zonedParts } from '@skedulei/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import * as agendaApi from '@/lib/api/agenda';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Escolher outro dia e horário para um agendamento (mesmo procedimento). `onConfirm` recebe o horário (ISO). */
export function ReschedulePicker({
  slug,
  serviceId,
  timezone,
  loading,
  onConfirm,
  onCancel,
}: {
  slug: string;
  serviceId: string;
  timezone: string;
  loading?: boolean;
  onConfirm: (startsAt: string) => void;
  onCancel: () => void;
}) {
  const today = todayIn(timezone);
  const days = React.useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = React.useState<string | null>(null);
  const [startsAt, setStartsAt] = React.useState<string | null>(null);
  const slots = useQuery({
    queryKey: ['public', slug, 'reschedule-slots', serviceId, date],
    queryFn: () => agendaApi.publicSlots(slug, { date: date!, serviceId }),
    enabled: !!date,
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Escolha o novo dia (até {ONLINE_BOOKING.maxDaysAhead} dias à frente)</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-none">
        {days.map((d) => {
          const [, m, dd] = d.split('-');
          return (
            <button
              key={d}
              type="button"
              aria-pressed={date === d}
              aria-label={`Novo dia ${dd}/${m}`}
              onClick={() => (setDate(d), setStartsAt(null))}
              className={cn('flex w-14 shrink-0 flex-col items-center rounded-2xl border-2 py-1.5', date === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}
            >
              <span className="text-[11px] font-bold uppercase">{d === today ? 'hoje' : WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
              <span className="font-display text-lg font-black">{dd}</span>
            </button>
          );
        })}
      </div>
      {date ? (
        slots.isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : slots.data?.slots.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.data.slots.map((s) => (
              <button
                key={s.startsAt}
                type="button"
                aria-pressed={startsAt === s.startsAt}
                aria-label={`Novo horário ${zonedParts(new Date(s.startsAt), timezone).time}`}
                onClick={() => setStartsAt(s.startsAt)}
                className={cn('rounded-xl border-2 py-2 text-sm font-semibold tabular', startsAt === s.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}
              >
                {zonedParts(new Date(s.startsAt), timezone).time}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem horários livres nesse dia. Tente outro. 🙏</p>
        )
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="button" className="flex-1" disabled={!startsAt} loading={loading} onClick={() => startsAt && onConfirm(startsAt)}>
          Confirmar novo horário
        </Button>
      </div>
    </div>
  );
}
