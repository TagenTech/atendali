'use client';

import { APPOINTMENT_STATUS_LABEL, formatDateLong, isValidPhone, ONLINE_BOOKING, whatsappLink, zonedParts, type PortalBookingDto } from '@skedulei/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, MapPin, MessageCircle, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ReschedulePicker } from '@/components/public/reschedule-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import * as agendaApi from '@/lib/api/agenda';
import { errorText } from '@/lib/api/client';
import { capitalize } from '@/lib/format';
import { buildIcs, downloadIcs } from '@/lib/ics';

/**
 * "Minhas reservas": a pessoa informa o celular, recebe um código no e-mail cadastrado nele e vê, remarca ou
 * cancela as reservas de todos os pacientes daquele celular. Sem conta, sem senha.
 */
export default function MinhasReservasPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const page = useQuery({ queryKey: ['public', slug], queryFn: () => agendaApi.publicPage(slug), retry: false });
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [moving, setMoving] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const list = useQuery({
    queryKey: ['portal', slug, token],
    queryFn: () => agendaApi.portalList(slug, token!),
    enabled: !!token,
    retry: false,
  });

  // Sessão vencida (ou inválida): volta para pedir o código.
  const expired = list.isError;
  const authed = !!token && !expired;

  if (page.isError) return <AuthLayout title="Página não encontrada">{null}</AuthLayout>;
  const org = page.data;

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError('Informe o celular com DDD');
    setBusy(true);
    setError(null);
    try {
      await agendaApi.portalCode(slug, phone);
      setToken(null);
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return setError('O código tem 6 números');
    setBusy(true);
    setError(null);
    try {
      setToken((await agendaApi.portalVerify(slug, phone, code.trim())).token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['portal', slug, token] });
  const cancel = async (b: PortalBookingDto) => {
    if (confirming !== b.id) return setConfirming(b.id);
    setBusy(true);
    try {
      await agendaApi.portalCancel(slug, token!, b.id);
      toast.success('Horário cancelado');
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };
  const reschedule = async (b: PortalBookingDto, startsAt: string) => {
    setBusy(true);
    try {
      await agendaApi.portalReschedule(slug, token!, b.id, { startsAt });
      toast.success('Horário remarcado ✓');
      setMoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Button asChild variant="ghost" block>
      <Link href={`/${slug}`}>Voltar para {org?.name ?? 'a página'}</Link>
    </Button>
  );

  // 1) Celular → 2) Código → 3) Reservas
  if (!authed) {
    const shown = error ?? (expired ? 'Sua sessão acabou. Peça um novo código.' : undefined);
    return (
      <AuthLayout title="Minhas reservas" subtitle={org?.name}>
        {!sent || expired ? (
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">Informe o celular que você usou ao marcar. Enviamos um código para o e-mail cadastrado nele.</p>
            <Field label="Celular (WhatsApp)" htmlFor="mr-phone" error={shown}>
              <PhoneInput id="mr-phone" value={phone} onChange={(v) => (setPhone(v), setError(null))} />
            </Field>
            <Button type="submit" size="lg" block loading={busy}>
              Enviar código
            </Button>
            {back}
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <p role="status" className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary-soft-foreground">
              Se esse celular tiver e-mail cadastrado, o código já está a caminho (vale por {ONLINE_BOOKING.codeTtlMinutes} minutos).
            </p>
            <Field label="Código de 6 números" htmlFor="mr-code" error={shown}>
              <Input id="mr-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => (setCode(e.target.value.replace(/\D/g, '')), setError(null))} className="tabular tracking-[0.4em]" />
            </Field>
            <Button type="submit" size="lg" block loading={busy}>
              Ver minhas reservas
            </Button>
            <Button type="button" variant="ghost" block onClick={() => (setSent(false), setCode(''), setError(null))}>
              Usar outro celular ou pedir outro código
            </Button>
            {org?.phone ? (
              <Button asChild variant="outline" block>
                <a href={whatsappLink(org.phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Não chegou? Falar com {org.name}
                </a>
              </Button>
            ) : null}
          </form>
        )}
      </AuthLayout>
    );
  }

  const bookings = list.data ?? [];
  return (
    <AuthLayout title="Minhas reservas" subtitle={org?.name}>
      <div className="space-y-4">
        {list.isLoading ? <p className="text-center text-muted-foreground">Carregando…</p> : null}
        {!list.isLoading && !bookings.length ? <p className="text-center text-muted-foreground">Nenhuma reserva por vir nesse celular. 💜</p> : null}
        {bookings.map((b) => {
          const p = zonedParts(new Date(b.startsAt), b.timezone);
          return (
            <Card key={b.id} className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{b.patientName}</p>
                <p className="font-display text-lg font-extrabold">{b.serviceName}</p>
                <p>
                  {capitalize(formatDateLong(p.date, false))} às <strong>{p.time}</strong>
                </p>
                <p className="text-sm text-muted-foreground">com {b.professionalName} · {APPOINTMENT_STATUS_LABEL[b.status]}</p>
                {b.address ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {b.address}
                  </p>
                ) : null}
              </div>
              {moving === b.id ? (
                <ReschedulePicker slug={slug} serviceId={b.serviceId} timezone={b.timezone} loading={busy} onCancel={() => setMoving(null)} onConfirm={(s) => reschedule(b, s)} />
              ) : b.canChange ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="soft" onClick={() => setMoving(b.id)} aria-label={`Remarcar ${b.patientName}, ${b.serviceName}`}>
                    <Repeat /> Remarcar
                  </Button>
                  <Button size="sm" variant="danger" loading={busy && confirming === b.id} onClick={() => cancel(b)} aria-label={`${confirming === b.id ? 'Confirmar cancelamento de' : 'Cancelar'} ${b.patientName}, ${b.serviceName}`}>
                    {confirming === b.id ? 'Confirmar cancelamento' : 'Cancelar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadIcs('reserva.ics', buildIcs({ uid: b.id, title: `${b.serviceName} · ${org?.name ?? ''}`, startsAt: b.startsAt, endsAt: b.endsAt, location: b.address, description: `Com ${b.professionalName}` }))}>
                    <CalendarPlus /> Calendário
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Para mudar com menos de {ONLINE_BOOKING.cancelUntilHours}h de antecedência, fale com o estabelecimento.</p>
              )}
            </Card>
          );
        })}
        {org?.phone ? (
          <Button asChild variant="outline" block>
            <a href={whatsappLink(org.phone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Falar com {org.name}
            </a>
          </Button>
        ) : null}
        {back}
      </div>
    </AuthLayout>
  );
}
