'use client';

import { formatDateShort, slotOpenedMessage, whatsappLink, zonedParts, type WaitlistEntryDto } from '@skedulei/contracts';
import { BellRing, CalendarPlus, Check, MessageCircle, Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useAddWaitlist, useResolveWaitlist, useWaitlist } from '@/lib/queries/agenda';
import { useServices } from '@/lib/queries/org';
import { clientBody, ClientPicker, type PickedClient } from './client-picker';
import type { NewAppointmentPrefill } from './new-appointment-sheet';

const selectCls = 'h-13 w-full rounded-2xl border border-input bg-card px-3 outline-none focus:border-primary';

/**
 * Lista de espera: quem quer um horário que não tinha. Quando um horário que combina é
 * cancelado, o pedido ganha o aviso "abriu vaga" com a mensagem pronta para o WhatsApp.
 */
export function WaitlistSheet({
  professionals,
  defaultDate,
  onBook,
  onOpenChange,
}: {
  professionals: { id: string; name: string }[];
  defaultDate: string;
  onBook: (prefill: NewAppointmentPrefill) => void;
  onOpenChange: (v: boolean) => void;
}) {
  const { org, vocab } = useOrg();
  const { data: entries = [] } = useWaitlist();
  const services = (useServices().data ?? []).filter((s) => s.active);
  const add = useAddWaitlist();
  const resolve = useResolveWaitlist();
  const [adding, setAdding] = React.useState(false);
  const [picked, setPicked] = React.useState<PickedClient>(null);
  const [serviceId, setServiceId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [date, setDate] = React.useState(defaultDate);
  const [notes, setNotes] = React.useState('');
  const [clientError, setClientError] = React.useState<string | null>(null);
  const tz = org.timezone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || (picked.newClient && !picked.newClient.name.trim())) {
      setClientError(`Escolha o ${vocab.client.toLowerCase()} ou informe o nome`);
      return;
    }
    setClientError(null);
    try {
      await add.mutateAsync({ ...clientBody(picked), serviceId: serviceId || null, memberId: memberId || null, preferredDate: date || null, notes: notes.trim() || null });
      toast.success('Na lista de espera ✓');
      setAdding(false);
      setPicked(null);
      setNotes('');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const book = (w: WaitlistEntryDto) => {
    const slot = w.openSlot ? zonedParts(new Date(w.openSlot.startsAt), tz) : null;
    onBook({
      date: slot?.date ?? w.preferredDate ?? defaultDate,
      time: slot?.time,
      memberId: w.openSlot?.memberId ?? w.memberId ?? undefined,
      serviceId: w.serviceId ?? undefined,
      client: { id: w.clientId, name: w.clientName },
      waitlistId: w.id,
    });
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title="Lista de espera" description="Quando um horário que combina é cancelado, avisamos aqui.">
      <div className="space-y-4">
        {entries.length ? (
          <ul className="space-y-2">
            {entries.map((w) => {
              const slot = w.openSlot ? zonedParts(new Date(w.openSlot.startsAt), tz) : null;
              return (
                <li key={w.id} className="space-y-2 rounded-2xl border border-input p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {[w.serviceName, w.memberName ?? 'qualquer profissional', w.preferredDate ? formatDateShort(w.preferredDate, false) : 'qualquer dia'].filter(Boolean).join(' · ')}
                      </p>
                      {w.notes ? <p className="text-sm text-muted-foreground">“{w.notes}”</p> : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Tirar ${w.clientName} da lista`}
                      title="Resolvido"
                      onClick={async () => {
                        try {
                          await resolve.mutateAsync(w.id);
                          toast.success('Saiu da lista de espera');
                        } catch (err) {
                          toast.error(errorText(err));
                        }
                      }}
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                    >
                      <Check className="size-4" />
                    </button>
                  </div>
                  {slot && w.openSlot ? (
                    <p className="flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success-soft-foreground">
                      <BellRing className="size-4" /> Abriu vaga: {formatDateShort(slot.date, false)} às {slot.time} com {w.openSlot.memberName}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => book(w)}>
                      <CalendarPlus /> Agendar
                    </Button>
                    {w.clientPhone && w.openSlot ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={whatsappLink(
                            w.clientPhone,
                            slotOpenedMessage({ clientName: w.clientName, organizationName: org.name, startsAt: w.openSlot.startsAt, timezone: tz, professionalName: w.openSlot.memberName }),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle /> Avisar no WhatsApp
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">Ninguém esperando vaga.</p>
        )}

        {adding ? (
          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-input p-4" noValidate>
            <p className="font-display font-extrabold">Novo pedido</p>
            <ClientPicker value={picked} onChange={(v) => (setPicked(v), setClientError(null))} />
            {clientError ? (
              <p role="alert" className="-mt-1 pl-1 text-sm font-medium text-danger">
                {clientError}
              </p>
            ) : null}
            <Field label={`${vocab.service} (opcional)`} htmlFor="wl-service">
              <select id="wl-service" className={selectCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Qualquer</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Profissional" htmlFor="wl-member">
                <select id="wl-member" className={selectCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">Qualquer</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dia" htmlFor="wl-date" hint="Vazio = qualquer dia">
                <Input id="wl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Observação" htmlFor="wl-notes">
              <Input id="wl-notes" maxLength={300} placeholder="Ex.: só depois das 17h" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" loading={add.isPending}>
                Colocar na lista
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" block onClick={() => setAdding(true)}>
            <Plus /> Adicionar à lista
          </Button>
        )}
      </div>
    </Sheet>
  );
}
