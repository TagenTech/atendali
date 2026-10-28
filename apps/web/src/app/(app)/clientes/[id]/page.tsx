'use client';

import {
  APPOINTMENT_STATUS_LABEL,
  formatBRL,
  formatDateShort,
  formatPhone,
  Permission,
  todayIn,
  whatsappLink,
  zonedParts,
  ageLabel,
  GUARDIAN_RELATIONSHIP_LABEL,
} from '@skedulei/contracts';
import { CalendarPlus, Mail, MessageCircle, Pencil, Phone, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ClientSheet } from '@/components/agenda/client-sheet';
import { NewAppointmentSheet } from '@/components/agenda/new-appointment-sheet';
import { STATUS_DOT } from '@/components/agenda/status';
import { ClientRetention } from '@/components/org/client-retention';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useClient, useRemoveClient } from '@/lib/queries/agenda';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/utils';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="font-display text-2xl font-black tabular">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}

export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const back = useBack('/clientes');
  const router = useRouter();
  const { org, can, vocab } = useOrg();
  const hydrated = useHydrated();
  const { data: c, isLoading, isError } = useClient(id);
  const remove = useRemoveClient();
  const [editing, setEditing] = React.useState(false);
  const [booking, setBooking] = React.useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const canEdit = can(Permission.CLIENTS_MANAGE);
  const tz = org.timezone;

  if (isError) return <EmptyState emoji="🔎" title={`${vocab.client} não encontrado`} description="Pode ter sido removido." />;
  if (isLoading || !c) return <Skeleton className="m-5 h-96 rounded-3xl" />;

  return (
    <>
      <FormTopBar onBack={back} title={c.name}>
        {canEdit ? (
          <Button size="sm" variant="soft" onClick={() => setEditing(true)}>
            <Pencil /> Editar
          </Button>
        ) : null}
      </FormTopBar>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 pb-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="font-display text-2xl font-black">{c.name}</p>
            {c.phone ? (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" /> {formatPhone(c.phone)}
              </p>
            ) : null}
            {c.email ? (
              <p className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" /> {c.email}
              </p>
            ) : null}
            {c.birthDate ? (
              <p className="text-sm text-muted-foreground">
                Nascimento: {formatDateShort(c.birthDate)}
                {hydrated && ageLabel(c.birthDate, todayIn(org.timezone)) ? ` · ${ageLabel(c.birthDate, todayIn(org.timezone))}` : ''}
              </p>
            ) : null}
            {c.guardianName ? (
              <p className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span>
                  Responsável: <strong>{c.guardianName}</strong>
                  {c.guardianRelationship ? ` (${GUARDIAN_RELATIONSHIP_LABEL[c.guardianRelationship].toLowerCase()})` : ''}
                </span>
              </p>
            ) : null}
            {c.relatives.length ? (
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mesmo telefone</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.relatives.map((r) => (
                    <Link key={r.id} href={`/clientes/${r.id}`} className="rounded-full bg-muted px-3 py-1 text-sm font-semibold hover:bg-primary-soft">
                      {r.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {c.tags.length ? (
              <div className="flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-soft-foreground">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            {c.notes ? <p className="whitespace-pre-line rounded-2xl bg-warning-soft p-3 text-sm text-warning-soft-foreground">{c.notes}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {can(Permission.AGENDA_OWN) ? (
                <Button size="sm" onClick={() => setBooking(Date.now())}>
                  <CalendarPlus /> Agendar
                </Button>
              ) : null}
              {c.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Atendimentos" value={String(c.stats.done)} />
            <Stat label="Faltas" value={String(c.stats.noShows)} />
            <Stat label="Total gasto" value={formatBRL(c.stats.spentCents)} />
            <Stat label="Última visita" value={c.stats.lastVisit ? formatDateShort(zonedParts(new Date(c.stats.lastVisit), tz).date, false) : '—'} />
          </div>
          <ClientRetention clientId={c.id} />
          {canEdit ? (
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                try {
                  await remove.mutateAsync(c.id);
                  toast.success('Dados apagados');
                  router.replace('/clientes');
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              <Trash2 /> {confirmDelete ? 'Confirmar: apagar dados pessoais' : 'Excluir (LGPD)'}
            </Button>
          ) : null}
        </div>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</h2>
          {c.appointments.length ? (
            <Card className="divide-y divide-border p-0">
              {c.appointments.map((a) => {
                const p = zonedParts(new Date(a.startsAt), tz);
                return (
                  <div key={a.id} className={cn('flex items-center gap-3 px-4 py-3', a.status === 'CANCELADO' && 'opacity-60')}>
                    <span className="w-20 shrink-0 text-sm font-bold tabular">
                      {formatDateShort(p.date, hydrated && p.date.slice(0, 4) !== todayIn(tz).slice(0, 4))}
                      <span className="block font-normal text-muted-foreground">{p.time}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.serviceName}</span>
                      <span className="block truncate text-sm text-muted-foreground">{a.memberName}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className={cn('size-2 rounded-full', STATUS_DOT[a.status])} /> {APPOINTMENT_STATUS_LABEL[a.status]}
                    </span>
                  </div>
                );
              })}
            </Card>
          ) : (
            <EmptyState emoji="🗓️" title="Sem atendimentos ainda" description="Agende o primeiro horário." />
          )}
        </section>
      </div>
      {editing ? <ClientSheet client={c} onOpenChange={setEditing} /> : null}
      {booking ? (
        <NewAppointmentSheet
          key={booking}
          open
          onOpenChange={(v) => !v && setBooking(null)}
          prefill={{ date: todayIn(tz), client: { id: c.id, name: c.name } }}
        />
      ) : null}
    </>
  );
}
