'use client';

import { APPOINTMENT_STATUS_LABEL, formatDateLong, ONLINE_BOOKING, whatsappLink, zonedParts, type PublicBookingItemDto } from '@skedulei/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, CalendarPlus, CalendarX2, CheckCircle2, MapPin, MessageCircle, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ReschedulePicker } from '@/components/public/reschedule-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import * as agendaApi from '@/lib/api/agenda';
import { errorText } from '@/lib/api/client';
import { capitalize } from '@/lib/format';
import { buildIcsMany, downloadIcs } from '@/lib/ics';
import { forgetBooking } from '@/lib/my-bookings-device';

const ALL = 'ALL';

/** "Minha reserva": o link que o cliente recebe para ver, remarcar e cancelar, sem login. Vale para um ou vários procedimentos. */
export default function ReservaPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const { data: g, isError } = useQuery({ queryKey: ['booking-group', token], queryFn: () => agendaApi.publicGroup(token), retry: false });
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [moving, setMoving] = React.useState<string | null>(null);

  if (isError) {
    return (
      <AuthLayout title="Reserva não encontrada" subtitle="Confira o link que você recebeu.">
        {null}
      </AuthLayout>
    );
  }
  if (!g) return <AuthLayout title="Carregando…">{null}</AuthLayout>;

  const many = g.items.length > 1;
  const active = g.items.filter((i) => i.status !== 'CANCELADO');
  const cancelled = active.length === 0;
  const changeable = active.filter((i) => i.canCancel);
  const toConfirm = active.filter((i) => i.canConfirm);
  const set = (next: typeof g) => qc.setQueryData(['booking-group', token], next);

  const cancel = async (key: string, itemId?: string) => {
    if (confirming !== key) return setConfirming(key);
    setBusy(key);
    try {
      const next = await agendaApi.publicGroupCancel(token, itemId);
      set(next);
      if (next.items.every((i) => i.status === 'CANCELADO')) forgetBooking(token);
      toast.success(itemId ? 'Horário cancelado' : many ? 'Horários cancelados' : 'Horário cancelado');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const confirm = async () => {
    setBusy('confirm');
    try {
      set(await agendaApi.publicGroupConfirm(token));
      toast.success('Presença confirmada ✓');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const reschedule = async (item: PublicBookingItemDto, startsAt: string) => {
    setBusy(`move-${item.id}`);
    try {
      set(await agendaApi.publicGroupReschedule(token, { itemId: item.id, startsAt }));
      toast.success('Horário remarcado ✓');
      setMoving(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const title = cancelled ? (many ? 'Horários cancelados' : 'Horário cancelado') : many ? 'Horários marcados! 🎉' : 'Horário marcado! 🎉';
  return (
    <AuthLayout title={title} subtitle={g.organizationName}>
      <div className="space-y-4">
        {g.items.map((b) => {
          const p = zonedParts(new Date(b.startsAt), g.timezone);
          const gone = b.status === 'CANCELADO';
          return (
            <Card key={b.id} className="space-y-2 text-center">
              {gone ? <CalendarX2 className="mx-auto size-8 text-danger" /> : <CalendarCheck2 className="mx-auto size-8 text-success" />}
              <p className={gone ? 'font-display text-xl font-extrabold line-through opacity-70' : 'font-display text-xl font-extrabold'}>{b.serviceName}</p>
              <p className="text-lg">
                {capitalize(formatDateLong(p.date, false))} às <strong>{p.time}</strong>
              </p>
              <p className="text-sm text-muted-foreground">com {b.professionalName}</p>
              <p className="text-sm text-muted-foreground">
                Atendimento de <strong>{b.clientName}</strong>
              </p>
              {g.address && b === g.items[0] ? (
                <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> {g.address}
                </p>
              ) : null}
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{APPOINTMENT_STATUS_LABEL[b.status]}</p>

              {many && !gone && b.canCancel ? (
                moving === b.id ? (
                  <div className="pt-2 text-left">
                    <ReschedulePicker slug={g.organizationSlug} serviceId={b.serviceId} timezone={g.timezone} loading={busy === `move-${b.id}`} onCancel={() => setMoving(null)} onConfirm={(s) => reschedule(b, s)} />
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <Button size="sm" variant="soft" onClick={() => setMoving(b.id)} aria-label={`Remarcar ${b.serviceName}`}>
                      <Repeat /> Remarcar
                    </Button>
                    <Button size="sm" variant="danger" loading={busy === b.id} onClick={() => cancel(b.id, b.id)} aria-label={`${confirming === b.id ? 'Confirmar cancelamento de' : 'Cancelar'} ${b.serviceName}`}>
                      {confirming === b.id ? 'Confirmar' : 'Cancelar'}
                    </Button>
                  </div>
                )
              ) : null}
            </Card>
          );
        })}

        {!cancelled ? (
          <>
            <p className="text-center text-sm text-muted-foreground">Guarde este link: é por ele que você vê, muda ou cancela {many ? 'os horários' : 'o horário'}.</p>
            <Button
              variant="outline"
              block
              onClick={() =>
                downloadIcs(
                  'reserva.ics',
                  buildIcsMany(
                    active.map((b) => ({
                      uid: b.id,
                      title: `${b.serviceName} · ${g.organizationName}`,
                      startsAt: b.startsAt,
                      endsAt: b.endsAt,
                      location: g.address,
                      description: `Com ${b.professionalName}. Ver ou mudar: ${window.location.href}`,
                    })),
                  ),
                )
              }
            >
              <CalendarPlus /> Adicionar ao calendário
            </Button>
          </>
        ) : null}

        {toConfirm.length ? (
          <Button size="lg" block loading={busy === 'confirm'} onClick={confirm}>
            <CheckCircle2 /> {many ? 'Confirmar presença em todos' : 'Confirmar presença'}
          </Button>
        ) : null}

        {!many && changeable[0] ? (
          moving === changeable[0].id ? (
            <Card className="space-y-3">
              <p className="font-display text-lg font-extrabold">Remarcar</p>
              <ReschedulePicker slug={g.organizationSlug} serviceId={changeable[0].serviceId} timezone={g.timezone} loading={busy === `move-${changeable[0].id}`} onCancel={() => setMoving(null)} onConfirm={(s) => reschedule(changeable[0], s)} />
            </Card>
          ) : (
            <Button variant="soft" block onClick={() => setMoving(changeable[0].id)}>
              <Repeat /> Remarcar
            </Button>
          )
        ) : null}

        {changeable.length ? (
          <Button variant="danger" block loading={busy === ALL} onClick={() => cancel(ALL)}>
            {confirming === ALL ? 'Confirmar cancelamento' : many ? 'Cancelar tudo' : 'Cancelar horário'}
          </Button>
        ) : !cancelled ? (
          <p className="text-center text-sm text-muted-foreground">Para cancelar com menos de {ONLINE_BOOKING.cancelUntilHours}h, fale com o estabelecimento.</p>
        ) : null}

        {g.organizationPhone ? (
          <Button asChild variant="outline" block>
            <a href={whatsappLink(g.organizationPhone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Falar com {g.organizationName}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="ghost" block>
          <Link href={`/${g.organizationSlug}`}>Agendar outro horário</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
