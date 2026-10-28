'use client';

import { Permission, zonedParts, zonedToUtc, type AgendaDayDto } from '@skedulei/contracts';
import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useFieldErrors } from '@/lib/use-field-errors';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCreateBlock, useRemoveBlock } from '@/lib/queries/agenda';

/** Bloquear horário (folga, almoço, curso) e ver/remover os bloqueios do dia. */
export function BlockSheet({ day, onOpenChange }: { day: AgendaDayDto; onOpenChange: (v: boolean) => void }) {
  const { org, can } = useOrg();
  const create = useCreateBlock();
  const remove = useRemoveBlock();
  const all = can(Permission.AGENDA_MANAGE_ALL);
  const [memberId, setMemberId] = React.useState(all ? '' : org.me.memberId);
  const [startTime, setStartTime] = React.useState('12:00');
  const [endTime, setEndTime] = React.useState('13:00');
  const [reason, setReason] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();
  const name = (id: string | null) => (id ? (day.professionals.find((p) => p.id === id)?.name ?? 'Profissional') : 'Unidade inteira');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !fail({
        'bl-member': !all && !memberId && 'Escolha quem fica bloqueado',
        'bl-start': !startTime && 'Informe a hora de início',
        'bl-end': !endTime ? 'Informe a hora de fim' : startTime && endTime <= startTime && 'O fim precisa ser depois do início',
      })
    )
      return;
    try {
      await create.mutateAsync({
        memberId: memberId || null,
        startsAt: zonedToUtc(day.date, startTime, day.timezone).toISOString(),
        endsAt: zonedToUtc(day.date, endTime, day.timezone).toISOString(),
        reason: reason.trim() || null,
      });
      toast.success('Horário bloqueado');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title="Bloquear horário" description="Folga, almoço, curso ou feriado: ninguém agenda por cima.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Para quem" htmlFor="bl-member" error={errors['bl-member']}>
          <select id="bl-member" value={memberId} onChange={(e) => (setMemberId(e.target.value), clear('bl-member'))} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3">
            {all ? <option value="">Unidade inteira</option> : null}
            {day.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Das" htmlFor="bl-start" error={errors['bl-start']}>
            <Input id="bl-start" type="time" step={300} value={startTime} invalid={!!errors['bl-start']} onChange={(e) => (setStartTime(e.target.value), clear('bl-start'), clear('bl-end'))} />
          </Field>
          <Field label="Às" htmlFor="bl-end" error={errors['bl-end']}>
            <Input id="bl-end" type="time" step={300} value={endTime} invalid={!!errors['bl-end']} onChange={(e) => (setEndTime(e.target.value), clear('bl-end'))} />
          </Field>
        </div>
        <Field label="Motivo (opcional)" htmlFor="bl-reason">
          <Input id="bl-reason" maxLength={120} value={reason} placeholder="Ex.: Almoço" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="submit" block loading={create.isPending}>
          Bloquear
        </Button>
      </form>

      {day.blocks.length ? (
        <section className="mt-6 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Bloqueios deste dia</h3>
          {day.blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm">
              <span className="flex-1">
                <strong>
                  {zonedParts(new Date(b.startsAt), day.timezone).time}–{zonedParts(new Date(b.endsAt), day.timezone).time}
                </strong>{' '}
                · {name(b.memberId)}
                {b.reason ? ` · ${b.reason}` : ''}
              </span>
              <button
                type="button"
                aria-label="Remover bloqueio"
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                onClick={async () => {
                  try {
                    await remove.mutateAsync(b.id);
                    toast.success('Bloqueio removido');
                  } catch (err) {
                    toast.error(errorText(err));
                  }
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </Sheet>
  );
}
