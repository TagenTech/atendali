'use client';

import {
  APPOINTMENT_STATUS_LABEL,
  Permission,
  confirmationMessage,
  formatBRL,
  STATUS_FLOW,
  whatsappLink,
  zonedParts,
  zonedToUtc,
  type AppointmentDto,
  type AppointmentStatus,
} from '@agendei/contracts';
import { CalendarClock, Clock, Globe, Megaphone, MessageCircle, Receipt, Scissors, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import * as fin from '@/lib/api/finance';
import { useUpdateAppointment } from '@/lib/queries/agenda';
import { useFinanceMutation } from '@/lib/queries/finance';
import { useCallAppointment } from '@/lib/queries/retention';
import { cn } from '@/lib/utils';
import { STATUS_DOT } from './status';

/** Rótulo do botão para levar ao status. */
const ACTION: Record<AppointmentStatus, string> = {
  AGENDADO: 'Reabrir',
  CONFIRMADO: 'Confirmado',
  CHEGOU: 'Chegou',
  EM_ATENDIMENTO: 'Iniciar atendimento',
  CONCLUIDO: 'Concluir',
  FALTOU: 'Faltou',
  CANCELADO: 'Cancelar',
};

export function AppointmentSheet({
  appointment: a,
  professionals,
  onOpenChange,
}: {
  appointment: AppointmentDto;
  professionals: { id: string; name: string }[];
  onOpenChange: (v: boolean) => void;
}) {
  const { org, vocab, can } = useOrg();
  const router = useRouter();
  const update = useUpdateAppointment();
  const call = useCallAppointment();
  const openOrder = useFinanceMutation((orgId, appointmentId: string) => fin.createOrder(orgId, { appointmentIds: [appointmentId] }));
  const tz = org.timezone;
  const start = zonedParts(new Date(a.startsAt), tz);
  const end = zonedParts(new Date(a.endsAt), tz);
  const [moving, setMoving] = React.useState(false);
  const [date, setDate] = React.useState(start.date);
  const [time, setTime] = React.useState(start.time);
  const [memberId, setMemberId] = React.useState(a.memberId);
  const [outside, setOutside] = React.useState(false);
  const [notes, setNotes] = React.useState(a.notes ?? '');

  const run = async (body: Parameters<typeof update.mutateAsync>[0]['body'], ok: string) => {
    try {
      await update.mutateAsync({ id: a.id, body });
      toast.success(ok);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const message = confirmationMessage({
    clientName: a.clientName,
    organizationName: org.name,
    serviceName: a.serviceName,
    professionalName: a.memberName,
    startsAt: a.startsAt,
    timezone: tz,
    priceCents: a.priceCents,
  });
  const [y, m, d] = start.date.split('-');

  return (
    <Sheet open onOpenChange={onOpenChange} title={a.clientName} description={`${d}/${m}/${y} · ${start.time}–${end.time}`}>
      <div className="space-y-5">
        <ul className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
          <li className="flex items-center gap-2">
            <Scissors className="size-4 text-muted-foreground" /> {a.serviceName} · <strong>{a.priceCents ? formatBRL(a.priceCents) : 'gratuito'}</strong>
          </li>
          <li className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" /> {a.memberName}
          </li>
          <li className="flex items-center gap-2">
            <span className={cn('size-2.5 rounded-full', STATUS_DOT[a.status])} /> {APPOINTMENT_STATUS_LABEL[a.status]}
            {a.source === 'ONLINE' ? (
              <span className="ml-auto flex items-center gap-1 text-xs font-bold text-primary">
                <Globe className="size-3.5" /> Agendado online
              </span>
            ) : null}
          </li>
          {a.notes ? <li className="text-muted-foreground">“{a.notes}”</li> : null}
        </ul>

        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW[a.status].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === 'CANCELADO' || s === 'FALTOU' ? 'danger' : s === 'CONCLUIDO' ? 'primary' : 'soft'}
              disabled={update.isPending}
              onClick={() => run({ status: s }, `${APPOINTMENT_STATUS_LABEL[s]} ✓`)}
            >
              {ACTION[s]}
            </Button>
          ))}
          {can(Permission.AGENDA_VIEW_ALL) && ['AGENDADO', 'CONFIRMADO', 'CHEGOU'].includes(a.status) ? (
            <Button
              size="sm"
              variant="outline"
              loading={call.isPending}
              onClick={async () => {
                try {
                  await call.mutateAsync(a.id);
                  toast.success('Chamando no painel de TV 📣');
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              <Megaphone /> Chamar
            </Button>
          ) : null}
        </div>

        {can(Permission.CASH_OPERATE) && a.status !== 'CANCELADO' ? (
          a.orderId ? (
            <Button asChild block variant="soft">
              <Link href={`/caixa/${a.orderId}`}>
                <Receipt /> Ver comanda
              </Link>
            </Button>
          ) : (
            <Button
              block
              loading={openOrder.isPending}
              onClick={async () => {
                try {
                  const o = await openOrder.mutateAsync(a.id);
                  router.push(`/caixa/${o.id}`);
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              <Receipt /> Abrir comanda
            </Button>
          )
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {a.clientPhone ? (
            <Button asChild variant="outline">
              <a href={whatsappLink(a.clientPhone, message)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Confirmar no WhatsApp
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/clientes/${a.clientId}`}>
              <UserRound /> Ficha do {vocab.client.toLowerCase()}
            </Link>
          </Button>
        </div>

        {a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO' ? (
          moving ? (
            <form
              className="space-y-3 rounded-2xl border-2 border-input p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  { startsAt: zonedToUtc(date, time, tz).toISOString(), memberId, allowOutsideHours: outside },
                  'Remarcado ✓',
                );
              }}
            >
              <p className="font-display font-extrabold">Remarcar</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dia" htmlFor="mv-date">
                  <Input id="mv-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                </Field>
                <Field label="Horário" htmlFor="mv-time">
                  <Input id="mv-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>
              {professionals.length > 1 ? (
                <Field label="Profissional" htmlFor="mv-member">
                  <select id="mv-member" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3">
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <SwitchRow id="mv-outside" checked={outside} onCheckedChange={setOutside} title="Encaixe" description="Fora do horário de funcionamento" />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setMoving(false)}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" loading={update.isPending}>
                  Salvar novo horário
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" block onClick={() => setMoving(true)}>
              <CalendarClock /> Remarcar
            </Button>
          )
        ) : null}

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ notes: notes.trim() || null }, 'Observação salva');
          }}
        >
          <Field label="Observação" htmlFor="ap-notes">
            <Textarea id="ap-notes" rows={2} maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {notes !== (a.notes ?? '') ? (
            <Button type="submit" size="sm" variant="soft" loading={update.isPending}>
              Salvar observação
            </Button>
          ) : null}
        </form>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Marcado em {new Date(a.createdAt).toLocaleString('pt-BR', { timeZone: tz })}
        </p>
      </div>
    </Sheet>
  );
}
