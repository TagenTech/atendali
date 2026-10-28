'use client';

import { formatBRL, formatDuration, Permission, zonedParts, zonedToUtc, type ClientDto } from '@agendei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useAgendaDay, useCreateAppointment, useResolveWaitlist, useSlots } from '@/lib/queries/agenda';
import { useServices } from '@/lib/queries/org';
import { cn } from '@/lib/utils';
import { clientBody, ClientPicker, type PickedClient } from './client-picker';

export interface NewAppointmentPrefill {
  date: string;
  memberId?: string;
  time?: string;
  serviceId?: string;
  client?: Pick<ClientDto, 'id' | 'name'>;
  /** Ao agendar, tira o pedido da lista de espera. */
  waitlistId?: string;
}

const selectCls = 'h-13 w-full rounded-2xl border-2 border-input bg-card px-3 outline-none focus:border-primary';

export function NewAppointmentSheet({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (v: boolean) => void; prefill: NewAppointmentPrefill }) {
  const { org, vocab, can } = useOrg();
  const create = useCreateAppointment();
  const resolveWaitlist = useResolveWaitlist();
  const services = (useServices().data ?? []).filter((s) => s.active);
  const [date, setDate] = React.useState(prefill.date);
  const day = useAgendaDay(date).data;
  const pros = day?.professionals ?? [];

  const [picked, setPicked] = React.useState<PickedClient>(prefill.client ? { client: prefill.client } : null);
  const [serviceId, setServiceId] = React.useState(prefill.serviceId ?? '');
  const [memberId, setMemberId] = React.useState(prefill.memberId ?? (can(Permission.AGENDA_VIEW_ALL) ? '' : org.me.memberId));
  const [time, setTime] = React.useState(prefill.time ?? '');
  const [outside, setOutside] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);
  const effectiveMember = memberId || pros[0]?.id || '';
  const slots = useSlots(serviceId && effectiveMember ? { date, serviceId, memberId: effectiveMember } : null).data?.slots ?? [];
  const slotTimes = slots.map((s) => zonedParts(new Date(s.startsAt), org.timezone).time);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !picked || (picked.newClient && !picked.newClient.name.trim())
      ? `Escolha ou cadastre o ${vocab.client.toLowerCase()}`
      : !serviceId
        ? `Escolha o ${vocab.service.toLowerCase()}`
        : !effectiveMember
          ? 'Escolha o profissional'
          : !/^\d{2}:\d{2}$/.test(time)
            ? 'Escolha o horário'
            : null;
    setError(problem);
    if (problem) return;
    try {
      await create.mutateAsync({
        ...clientBody(picked!),
        serviceId,
        memberId: effectiveMember,
        startsAt: zonedToUtc(date, time, org.timezone).toISOString(),
        notes: notes.trim() || null,
        allowOutsideHours: outside,
      });
      if (prefill.waitlistId) await resolveWaitlist.mutateAsync(prefill.waitlistId).catch(() => undefined);
      toast.success(`${vocab.appointment} marcado ✨`);
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err, 'Não foi possível agendar'));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Novo ${vocab.appointment.toLowerCase()}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-semibold">{vocab.client}</legend>
          <ClientPicker value={picked} onChange={setPicked} locked={!!prefill.client} />
        </fieldset>

        <Field label={vocab.service} htmlFor="na-service">
          <select id="na-service" className={selectCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Escolha…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatDuration(s.durationMinutes)} · {s.priceCents ? formatBRL(s.priceCents) : 'gratuito'}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Profissional" htmlFor="na-member" className="col-span-2">
            <select id="na-member" className={selectCls} value={effectiveMember} onChange={(e) => setMemberId(e.target.value)}>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dia" htmlFor="na-date">
            <Input id="na-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label="Horário" htmlFor="na-time">
            <Input id="na-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {service ? (
          slotTimes.length ? (
            <div>
              <p className="mb-2 pl-1 text-sm font-semibold">Livres para {formatDuration(service.durationMinutes)}</p>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                {slotTimes.map((t) => (
                  <Chip key={t} active={time === t} onClick={() => setTime(t)} className="tabular">
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ) : (
            <p className="pl-1 text-sm text-muted-foreground">Sem horário livre nesse dia — use encaixe se precisar.</p>
          )
        ) : null}

        <SwitchRow id="na-outside" checked={outside} onCheckedChange={setOutside} title="Encaixe" description="Permite marcar fora do horário de funcionamento" />
        <Field label="Observação (opcional)" htmlFor="na-notes">
          <Textarea id="na-notes" rows={2} maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error ? (
          <p role="alert" className={cn('rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground')}>
            {error}
          </p>
        ) : null}
        <Button type="submit" block size="lg" loading={create.isPending}>
          Agendar
        </Button>
      </form>
    </Sheet>
  );
}
