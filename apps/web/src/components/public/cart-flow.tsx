'use client';

import { anyOverlap, formatBRL, formatDuration, ONLINE_BOOKING, WEEKDAYS_SHORT, zonedParts, type PublicOrgDto, type SequencePlanDto } from '@skedulei/contracts';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { PatientForm, type PatientValues } from '@/components/public/patient-form';
import { Skeleton } from '@/components/ui/skeleton';
import * as agendaApi from '@/lib/api/agenda';
import { errorText } from '@/lib/api/client';
import { rememberBooking } from '@/lib/my-bookings-device';
import { cn } from '@/lib/utils';

type Service = PublicOrgDto['services'][number];
type Mode = 'SEQ' | 'SEP';
interface Chosen {
  date: string;
  startsAt: string;
}

function DayChips({ days, today, value, onPick, label }: { days: string[]; today: string | null; value: string | null; onPick: (d: string) => void; label: string }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 scrollbar-none">
      {days.map((d) => {
        const [, m, dd] = d.split('-');
        return (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            aria-label={`${label} ${dd}/${m}`}
            onClick={() => onPick(d)}
            className={cn('flex w-16 shrink-0 flex-col items-center rounded-2xl border-2 py-2', value === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}
          >
            <span className="text-xs font-bold uppercase">{d === today ? 'hoje' : WEEKDAYS_SHORT[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
            <span className="font-display text-xl font-black">{dd}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Um procedimento no modo "horários separados": escolhe dia e horário, sem bater com os outros já escolhidos. */
function SeparatePicker({
  slug,
  service,
  index,
  days,
  today,
  tz,
  chosen,
  blocked,
  onChoose,
}: {
  slug: string;
  service: Service;
  index: number;
  days: string[];
  today: string | null;
  tz: string;
  chosen: Chosen | undefined;
  blocked: { startsAt: string; endsAt: string }[];
  onChoose: (c: Chosen | undefined) => void;
}) {
  const [date, setDate] = React.useState<string | null>(chosen?.date ?? null);
  const slots = useQuery({
    queryKey: ['public', slug, 'slots', service.id, date],
    queryFn: () => agendaApi.publicSlots(slug, { date: date!, serviceId: service.id }),
    enabled: !!date,
  });
  const free = (slots.data?.slots ?? []).filter((s) => {
    const start = new Date(s.startsAt).getTime();
    const end = start + service.durationMinutes * 60_000;
    return !blocked.some((b) => start < new Date(b.endsAt).getTime() && new Date(b.startsAt).getTime() < end);
  });
  return (
    <section aria-label={`Horário de ${service.name}`} className="space-y-2 rounded-2xl border-2 border-border bg-card p-4">
      <p className="flex items-center justify-between gap-2 font-semibold">
        <span>
          {index + 1}. {service.name} <span className="text-sm font-normal text-muted-foreground">· {formatDuration(service.durationMinutes)}</span>
        </span>
        {chosen ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-success">
            <Check className="size-4" /> {chosen.date.split('-').reverse().slice(0, 2).join('/')} às {zonedParts(new Date(chosen.startsAt), tz).time}
          </span>
        ) : null}
      </p>
      <DayChips days={days} today={today} value={date} onPick={(d) => (setDate(d), onChoose(undefined))} label={`Dia de ${service.name}`} />
      {date ? (
        slots.isLoading ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : free.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {free.map((s) => (
              <button
                key={s.startsAt}
                type="button"
                aria-pressed={chosen?.startsAt === s.startsAt}
                aria-label={`${service.name} às ${zonedParts(new Date(s.startsAt), tz).time}`}
                onClick={() => onChoose({ date, startsAt: s.startsAt })}
                className={cn('rounded-xl border-2 py-2 text-sm font-semibold tabular', chosen?.startsAt === s.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}
              >
                {zonedParts(new Date(s.startsAt), tz).time}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem horários livres nesse dia (ou batem com os outros que você escolheu). Tente outro. 🙏</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Escolha o dia deste procedimento.</p>
      )}
    </section>
  );
}

/** Reserva de vários procedimentos: um logo após o outro, ou cada um no seu horário. */
export function CartFlow({
  slug,
  org,
  selected,
  days,
  today,
  tz,
}: {
  slug: string;
  org: PublicOrgDto;
  selected: Service[];
  days: string[];
  today: string | null;
  tz: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>('SEQ');
  const [seqDate, setSeqDate] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<SequencePlanDto | null>(null);
  const [chosen, setChosen] = React.useState<Record<string, Chosen | undefined>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = selected.map((s) => s.id);
  const timeOf = (iso: string) => zonedParts(new Date(iso), tz).time;
  const proName = (id: string) => org.professionals.find((p) => p.id === id)?.name ?? '';

  const sequence = useQuery({
    queryKey: ['public', slug, 'sequence', seqDate, ids.join(',')],
    queryFn: () => agendaApi.publicSequence(slug, seqDate!, ids),
    enabled: mode === 'SEQ' && !!seqDate,
  });

  const intervalOf = (s: Service, c: Chosen) => ({ startsAt: c.startsAt, endsAt: new Date(new Date(c.startsAt).getTime() + s.durationMinutes * 60_000).toISOString() });
  const sepReady = selected.every((s) => chosen[s.id]);
  const sepIntervals = selected.flatMap((s) => (chosen[s.id] ? [intervalOf(s, chosen[s.id]!)] : []));
  const overlapping = mode === 'SEP' && sepReady && anyOverlap(sepIntervals);
  const ready = mode === 'SEQ' ? !!plan : sepReady && !overlapping;

  const book = async (v: PatientValues) => {
    setSaving(true);
    setError(null);
    try {
      const items =
        mode === 'SEQ'
          ? plan!.items.map((i) => ({ serviceId: i.serviceId, memberId: i.memberId, startsAt: i.startsAt }))
          : selected.map((s) => ({ serviceId: s.id, startsAt: chosen[s.id]!.startsAt }));
      const res = await agendaApi.publicBookGroup(slug, { items, name: v.name, phone: v.phone, email: v.email, patientName: v.patientName, patientBirthDate: v.patientBirthDate, relationship: v.relationship });
      rememberBooking({ token: res.token, slug, serviceName: res.items.map((i) => i.serviceName).join(' + '), patientName: res.items[0].clientName, startsAt: res.items[0].startsAt, timezone: res.timezone });
      router.push(`/reserva/${res.token}`);
    } catch (err) {
      setError(errorText(err, 'Não foi possível agendar agora'));
      setPlan(null);
      setChosen({});
      setSaving(false);
    }
  };

  const totalMin = selected.reduce((s, x) => s + x.durationMinutes, 0);
  return (
    <>
      <section>
        <h2 className="mb-3 flex items-center gap-3 font-display text-xl font-extrabold">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">2</span>
          Como quer encaixar os {selected.length} {org.vocabulary.services.toLowerCase()}?
        </h2>
        <div role="radiogroup" aria-label="Como encaixar" className="grid gap-2 sm:grid-cols-2">
          {[
            { m: 'SEQ' as const, title: 'Um logo após o outro', desc: `Tudo no mesmo dia, sem espera (${formatDuration(totalMin)} no total)` },
            { m: 'SEP' as const, title: 'Escolher o horário de cada um', desc: 'Dias e horários diferentes, um a um' },
          ].map((o) => (
            <button
              key={o.m}
              type="button"
              role="radio"
              aria-checked={mode === o.m}
              onClick={() => (setMode(o.m), setError(null))}
              className={cn('rounded-2xl border-2 p-4 text-left', mode === o.m ? 'border-primary bg-primary-soft' : 'border-border bg-card')}
            >
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-3 font-display text-xl font-extrabold">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">3</span>
          {mode === 'SEQ' ? 'Dia e horário de início' : 'Dia e horário de cada um'}
        </h2>
        {mode === 'SEQ' ? (
          <>
            <DayChips days={days} today={today} value={seqDate} onPick={(d) => (setSeqDate(d), setPlan(null))} label="Dia" />
            {seqDate ? (
              sequence.isLoading ? (
                <Skeleton className="mt-3 h-24 rounded-2xl" />
              ) : sequence.data?.options.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {sequence.data.options.map((o) => {
                    const end = o.items[o.items.length - 1].endsAt;
                    return (
                      <button
                        key={o.startsAt}
                        type="button"
                        aria-pressed={plan?.startsAt === o.startsAt}
                        aria-label={`Começar às ${timeOf(o.startsAt)}`}
                        onClick={() => setPlan(o)}
                        className={cn('rounded-xl border-2 py-2 text-sm font-semibold tabular', plan?.startsAt === o.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50')}
                      >
                        {timeOf(o.startsAt)} → {timeOf(end)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-muted-foreground">Não há horário com tudo em sequência nesse dia. Tente outro dia ou escolha o horário de cada um. 🙏</p>
              )
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Escolha um dia (até {ONLINE_BOOKING.maxDaysAhead} dias à frente).</p>
            )}
            {plan ? (
              <ol className="mt-4 space-y-1 rounded-2xl bg-muted p-4 text-sm" aria-label="Ordem dos procedimentos">
                {plan.items.map((i, k) => (
                  <li key={i.serviceId}>
                    <strong>{timeOf(i.startsAt)}</strong> · {selected.find((s) => s.id === i.serviceId)?.name} <span className="text-muted-foreground">com {proName(i.memberId)}</span>
                    {k < plan.items.length - 1 ? '' : ''}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            {selected.map((s, i) => (
              <SeparatePicker
                key={s.id}
                slug={slug}
                service={s}
                index={i}
                days={days}
                today={today}
                tz={tz}
                chosen={chosen[s.id]}
                blocked={selected.flatMap((o) => (o.id !== s.id && chosen[o.id] ? [intervalOf(o, chosen[o.id]!)] : []))}
                onChoose={(c) => setChosen((prev) => ({ ...prev, [s.id]: c }))}
              />
            ))}
            {overlapping ? (
              <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
                Dois procedimentos ficaram no mesmo horário. Mude um deles.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {ready ? (
        <section>
          <h2 className="mb-3 flex items-center gap-3 font-display text-xl font-extrabold">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">4</span>
            Seus dados
          </h2>
          <PatientForm clientWord={org.vocabulary.client} today={today} saving={saving} error={error} submitLabel={`Confirmar ${selected.length} ${org.vocabulary.services.toLowerCase()}`} onSubmit={book} />
        </section>
      ) : error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      ) : null}
      <p className="sr-only">{formatBRL(selected.reduce((s, x) => s + x.priceCents, 0))}</p>
    </>
  );
}
