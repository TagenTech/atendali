'use client';

import { APPOINTMENT_STATUS_LABEL, formatDateLong, ONLINE_BOOKING, whatsappLink, zonedParts } from '@skedulei/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, CalendarPlus, CalendarX2, MapPin, MessageCircle, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { ReschedulePicker } from '@/components/public/reschedule-picker';
import { Card } from '@/components/ui/card';
import * as agendaApi from '@/lib/api/agenda';
import { errorText } from '@/lib/api/client';
import { capitalize } from '@/lib/format';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { forgetBooking } from '@/lib/my-bookings-device';

/** "Minha reserva": o link que o cliente recebe para ver e cancelar, sem login. */
export default function ReservaPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const { data: b, isError } = useQuery({ queryKey: ['booking', token], queryFn: () => agendaApi.publicBooking(token), retry: false });
  const [confirming, setConfirming] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  if (isError) {
    return (
      <AuthLayout title="Reserva não encontrada" subtitle="Confira o link que você recebeu.">
        {null}
      </AuthLayout>
    );
  }
  if (!b) return <AuthLayout title="Carregando…">{null}</AuthLayout>;

  const p = zonedParts(new Date(b.startsAt), b.timezone);
  const cancelled = b.status === 'CANCELADO';

  return (
    <AuthLayout title={cancelled ? 'Horário cancelado' : 'Horário marcado! 🎉'} subtitle={b.organizationName}>
      <div className="space-y-4">
        <Card className="space-y-2 text-center">
          {cancelled ? <CalendarX2 className="mx-auto size-8 text-danger" /> : <CalendarCheck2 className="mx-auto size-8 text-success" />}
          <p className="font-display text-xl font-extrabold">{b.serviceName}</p>
          <p className="text-lg">
            {capitalize(formatDateLong(p.date, false))} às <strong>{p.time}</strong>
          </p>
          <p className="text-sm text-muted-foreground">com {b.professionalName}</p>
          <p className="text-sm text-muted-foreground">Atendimento de <strong>{b.clientName}</strong></p>
          {b.address ? (
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {b.address}
            </p>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{APPOINTMENT_STATUS_LABEL[b.status]}</p>
        </Card>

        {!cancelled ? (
          <>
            <p className="text-center text-sm text-muted-foreground">Guarde este link: é por ele que você vê, muda ou cancela o horário.</p>
            <Button
              variant="outline"
              block
              onClick={() =>
                downloadIcs(
                  'reserva.ics',
                  buildIcs({ uid: token, title: `${b.serviceName} · ${b.organizationName}`, startsAt: b.startsAt, endsAt: b.endsAt, location: b.address, description: `Com ${b.professionalName}. Ver ou mudar: ${window.location.href}` }),
                )
              }
            >
              <CalendarPlus /> Adicionar ao calendário
            </Button>
          </>
        ) : null}

        {b.canCancel && moving ? (
          <Card className="space-y-3">
            <p className="font-display text-lg font-extrabold">Remarcar</p>
            <ReschedulePicker
              slug={b.organizationSlug}
              serviceId={b.serviceId}
              timezone={b.timezone}
              loading={saving}
              onCancel={() => setMoving(false)}
              onConfirm={async (startsAt) => {
                setSaving(true);
                try {
                  qc.setQueryData(['booking', token], await agendaApi.publicReschedule(token, { startsAt }));
                  toast.success('Horário remarcado ✓');
                  setMoving(false);
                } catch (err) {
                  toast.error(errorText(err));
                } finally {
                  setSaving(false);
                }
              }}
            />
          </Card>
        ) : b.canCancel ? (
          <Button variant="soft" block onClick={() => setMoving(true)}>
            <Repeat /> Remarcar
          </Button>
        ) : null}

        {b.canCancel ? (
          <Button
            variant="danger"
            block
            loading={cancelling}
            onClick={async () => {
              if (!confirming) return setConfirming(true);
              setCancelling(true);
              try {
                qc.setQueryData(['booking', token], await agendaApi.publicCancel(token));
                forgetBooking(token);
                toast.success('Horário cancelado');
              } catch (err) {
                toast.error(errorText(err));
              } finally {
                setCancelling(false);
                setConfirming(false);
              }
            }}
          >
            {confirming ? 'Confirmar cancelamento' : 'Cancelar horário'}
          </Button>
        ) : !cancelled ? (
          <p className="text-center text-sm text-muted-foreground">
            Para cancelar com menos de {ONLINE_BOOKING.cancelUntilHours}h, fale com o estabelecimento.
          </p>
        ) : null}

        {b.organizationPhone ? (
          <Button asChild variant="outline" block>
            <a href={whatsappLink(b.organizationPhone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Falar com {b.organizationName}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="ghost" block>
          <Link href={`/${b.organizationSlug}`}>Agendar outro horário</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
