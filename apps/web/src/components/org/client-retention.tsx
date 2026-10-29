'use client';

import { Feature, formatDateShort, MEMBERSHIP_STATE_LABEL, PACKAGE_STATUS_LABEL, Permission } from '@skedulei/contracts';
import { Gift, Sparkles, Ticket } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFieldErrors } from '@/lib/use-field-errors';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useAdjustPoints, useClientPackages, useLoyalty, useMemberships } from '@/lib/queries/retention';

const Title = ({ icon: Icon, children }: { icon: typeof Gift; children: React.ReactNode }) => (
  <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
    <Icon className="size-5 text-primary" /> {children}
  </h2>
);

/** Pacotes, clube e pontos da pessoa — só os módulos ligados no negócio. */
export function ClientRetention({ clientId }: { clientId: string }) {
  const { has, can, org } = useOrg();
  const showPackages = has(Feature.PACOTES);
  const showClub = has(Feature.ASSINATURAS);
  const showPoints = has(Feature.FIDELIDADE) && org.loyalty.enabled;
  const packages = useClientPackages({ clientId, enabled: showPackages });
  const memberships = useMemberships({ clientId, enabled: showClub });
  const loyalty = useLoyalty(clientId, showPoints);
  const adjust = useAdjustPoints();
  const [adjusting, setAdjusting] = React.useState(false);
  const [points, setPoints] = React.useState('');
  const [note, setNote] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();

  const visiblePackages = (packages.data ?? []).filter((p) => p.status === 'ATIVO' || p.sessionsLeft > 0);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.trunc(Number(points));
    if (!fail({ 'adj-points': !n && 'Informe os pontos (use − para tirar)', 'adj-note': !note.trim() && 'Conte o motivo' })) return;
    try {
      await adjust.mutateAsync({ clientId, points: n, note: note.trim() });
      toast.success('Pontos ajustados');
      setAdjusting(false);
      setPoints('');
      setNote('');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <>
      {showPackages && (packages.data?.length ?? 0) > 0 ? (
        <Card className="p-4">
          <Title icon={Ticket}>Pacotes</Title>
          <ul className="space-y-2">
            {(visiblePackages.length ? visiblePackages : (packages.data ?? []).slice(0, 2)).map((p) => (
              <li key={p.id} className="text-sm">
                <p className="font-semibold">
                  {p.planName} <span className="font-normal text-muted-foreground">· {PACKAGE_STATUS_LABEL[p.status]}</span>
                </p>
                <p className="text-muted-foreground">
                  {p.sessionsLeft} de {p.sessionsTotal} sessões{p.expiresAt ? ` · até ${formatDateShort(p.expiresAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {showClub && (memberships.data?.length ?? 0) > 0 ? (
        <Card className="p-4">
          <Title icon={Gift}>Clube</Title>
          <ul className="space-y-2">
            {(memberships.data ?? []).map((m) => (
              <li key={m.id} className="text-sm">
                <p className="font-semibold">
                  {m.planName} <span className="font-normal text-muted-foreground">· {MEMBERSHIP_STATE_LABEL[m.state]}</span>
                </p>
                <p className="text-muted-foreground">
                  {m.paidThrough ? `Pago até ${formatDateShort(m.paidThrough)}` : 'Sem mensalidade paga'}
                  {m.sessionsPerMonth ? ` · ${m.sessionsUsedInCycle}/${m.sessionsPerMonth} sessões no mês` : ' · ilimitado'}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {showPoints && loyalty.data ? (
        <Card className="p-4">
          <Title icon={Sparkles}>Pontos</Title>
          <p className="font-display text-3xl font-extrabold tabular">{loyalty.data.balance}</p>
          {loyalty.data.entries.length ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {loyalty.data.entries.slice(0, 4).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="truncate">{e.reason}</span>
                  <span className="font-semibold tabular">
                    {e.points > 0 ? '+' : ''}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {can(Permission.CLIENTS_MANAGE) ? (
            adjusting ? (
              <form onSubmit={submit} className="mt-3 space-y-2" noValidate>
                <Field label="Pontos (+ ou −)" htmlFor="adj-points" error={errors['adj-points']}>
                  <Input id="adj-points" type="number" inputMode="numeric" value={points} invalid={!!errors['adj-points']} onChange={(e) => (setPoints(e.target.value), clear('adj-points'))} />
                </Field>
                <Field label="Motivo" htmlFor="adj-note" error={errors['adj-note']}>
                  <Input id="adj-note" maxLength={200} value={note} invalid={!!errors['adj-note']} onChange={(e) => (setNote(e.target.value), clear('adj-note'))} />
                </Field>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAdjusting(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" loading={adjust.isPending}>
                    Ajustar
                  </Button>
                </div>
              </form>
            ) : (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdjusting(true)}>
                Ajustar pontos
              </Button>
            )
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
