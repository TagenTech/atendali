'use client';

import { addDays, birthdayMessage, comebackMessage, formatBRL, formatDateShort, formatDuration, todayIn, whatsappLink, type ReportOverview } from '@skedulei/contracts';
import { Cake, MessageCircle, UserRoundX } from 'lucide-react';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useBirthdays, useInactive, useOverview } from '@/lib/queries/reports';
import { useHydrated } from '@/lib/use-hydrated';

type Period = '7' | '30' | '90' | 'MES';
const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'MES', label: 'Este mês' },
];

const fmtPct = (v: number | null) => (v === null ? '—' : `${String(v).replace('.', ',')}%`);

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <Card className="space-y-0.5 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={tone === 'warn' ? 'font-display text-2xl font-black tabular text-warning' : 'font-display text-2xl font-black tabular'}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function Bar({ pct }: { pct: number | null }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={pct === null ? 'sem horário de trabalho' : `${pct}% ocupado`}>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
    </span>
  );
}

function Overview({ o }: { o: ReportOverview }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Atendimentos" value={String(o.concluded)} hint={`${o.total} no período`} />
        <Kpi label="Ticket médio" value={o.ticketCents === null ? '—' : formatBRL(o.ticketCents)} hint={`Receita ${formatBRL(o.revenueCents)}`} />
        <Kpi label="Faltas" value={fmtPct(o.noShowPct)} hint={`${o.noShows} ${o.noShows === 1 ? 'falta' : 'faltas'}`} tone={o.noShowPct !== null && o.noShowPct >= 15 ? 'warn' : undefined} />
        <Kpi label="Cancelamentos" value={fmtPct(o.cancelPct)} hint={`${o.cancelled} ${o.cancelled === 1 ? 'cancelado' : 'cancelados'}`} />
        <Kpi label="Ocupação da agenda" value={fmtPct(o.occupancyPct)} hint="Horas marcadas ÷ horas de trabalho" />
        <Kpi label="Clientes atendidos" value={String(o.clientsServed)} hint={`${o.newClients} novos`} />
        <Kpi label="Clientes que voltaram" value={fmtPct(o.returnPct)} hint={`${o.returningClients} já tinham vindo antes`} />
        <Kpi label="Reservas online" value={fmtPct(o.onlineSharePct)} hint="Parte do total de horários" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Serviços mais feitos">
          <h2 className="mb-2 font-display text-lg font-extrabold">Mais feitos</h2>
          {o.services.length ? (
            <Card className="divide-y divide-border p-0">
              {o.services.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-sm font-bold text-muted-foreground tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  <span className="text-sm text-muted-foreground tabular">{s.count}×</span>
                  <span className="w-24 text-right font-semibold tabular">{formatBRL(s.revenueCents)}</span>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="text-sm text-muted-foreground">Nenhum atendimento concluído no período.</Card>
          )}
        </section>
        <section aria-label="Equipe">
          <h2 className="mb-2 font-display text-lg font-extrabold">Equipe e ocupação</h2>
          {o.members.length ? (
            <Card className="divide-y divide-border p-0">
              {o.members.map((m) => (
                <div key={m.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                    <span className="text-sm text-muted-foreground tabular">{m.count} atend.</span>
                    <span className="w-24 text-right font-semibold tabular">{formatBRL(m.revenueCents)}</span>
                  </div>
                  <Bar pct={m.occupancyPct} />
                  <p className="text-xs text-muted-foreground">
                    {m.occupancyPct === null ? 'Sem horário de trabalho no período' : `${fmtPct(m.occupancyPct)} ocupado · ${formatDuration(m.bookedMinutes)} de ${formatDuration(m.availableMinutes)}`}
                  </p>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="text-sm text-muted-foreground">Ninguém na agenda ainda.</Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Inactive() {
  const { org, vocab } = useOrg();
  const [days, setDays] = React.useState(60);
  const { data, isLoading } = useInactive(days);
  return (
    <section aria-label="Sem voltar">
      <h2 className="mb-2 flex flex-wrap items-center gap-2 font-display text-lg font-extrabold">
        <UserRoundX className="size-5 text-primary" /> {vocab.clients} sem voltar
        <span className="ml-auto flex gap-2">
          {[30, 60, 90, 180].map((d) => (
            <Chip key={d} active={days === d} onClick={() => setDays(d)}>
              {d}+ dias
            </Chip>
          ))}
        </span>
      </h2>
      {isLoading ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : !data?.length ? (
        <EmptyState emoji="💜" title="Ninguém sumido" description={`Nenhum ${vocab.client.toLowerCase()} está há ${days} dias ou mais sem voltar.`} />
      ) : (
        <Card className="divide-y divide-border p-0">
          {data.slice(0, 30).map((c) => (
            <div key={c.clientId} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Última visita {formatDateShort(c.lastVisit)} · há {c.daysAway} dias · {c.visits} {c.visits === 1 ? 'visita' : 'visitas'}
                </span>
              </span>
              {c.phone ? (
                <Button asChild size="sm" variant="soft">
                  <a href={whatsappLink(c.phone, comebackMessage(c, org.name))} target="_blank" rel="noopener noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`}>
                    <MessageCircle /> Chamar
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function Birthdays() {
  const { org } = useOrg();
  const { data, isLoading } = useBirthdays(30);
  return (
    <section aria-label="Aniversariantes">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
        <Cake className="size-5 text-primary" /> Aniversariantes (próximos 30 dias)
      </h2>
      {isLoading ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : !data?.length ? (
        <Card className="text-sm text-muted-foreground">Ninguém faz aniversário nos próximos 30 dias (ou ainda falta cadastrar a data de nascimento).</Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {data.map((b) => (
            <div key={b.clientId} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {b.inDays === 0 ? 'Hoje! 🎉' : b.inDays === 1 ? 'Amanhã' : `${formatDateShort(b.date)} (em ${b.inDays} dias)`}
                  {b.turns ? ` · faz ${b.turns} anos` : ''}
                </span>
              </span>
              {b.phone ? (
                <Button asChild size="sm" variant="soft">
                  <a href={whatsappLink(b.phone, birthdayMessage(b, org.name))} target="_blank" rel="noopener noreferrer" aria-label={`Dar parabéns a ${b.name} no WhatsApp`}>
                    <MessageCircle /> Parabéns
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

export default function RelatoriosPage() {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const [period, setPeriod] = React.useState<Period>('30');
  const today = hydrated ? todayIn(org.timezone) : null;
  const range = React.useMemo(() => {
    if (!today) return { from: null, to: null };
    if (period === 'MES') return { from: `${today.slice(0, 8)}01`, to: today };
    return { from: addDays(today, -(Number(period) - 1)), to: today };
  }, [period, today]);
  const { data, isLoading } = useOverview(range.from, range.to);

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Como o negócio está indo" />
      <div className="space-y-6 px-5 pb-8">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <Chip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
              {p.label}
            </Chip>
          ))}
        </div>
        {isLoading || !data ? <Skeleton className="h-64 rounded-3xl" /> : <Overview o={data} />}
        <Inactive />
        <Birthdays />
      </div>
    </>
  );
}
