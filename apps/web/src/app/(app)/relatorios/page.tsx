'use client';

import {
  addDays,
  birthdayMessage,
  comebackMessage,
  formatBRL,
  formatDateShort,
  formatDuration,
  todayIn,
  whatsappLink,
  type ReportOverview,
} from '@skedulei/contracts';
import { Cake, MessageCircle, UserRoundX } from 'lucide-react';
import * as React from 'react';
import { Kpi } from '@/components/finance/kpi';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useBirthdays, useInactive, useOverview } from '@/lib/queries/reports';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/utils';

type Period = '7' | '30' | '90' | 'MES';
const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'MES', label: 'Este mês' },
];

const fmtPct = (v: number | null) => (v === null ? '—' : `${String(v).replace('.', ',')}%`);

function Bar({ pct }: { pct: number | null }) {
  return (
    <span
      className="block h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={pct === null ? 'sem horário de trabalho' : `${pct}% ocupado`}
    >
      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
    </span>
  );
}

function Overview({ o }: { o: ReportOverview }) {
  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up sm:px-6 sm:py-6">
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          <div className="min-w-0 sm:col-span-1">
            <p className="text-sm text-white/65">Atendimentos</p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular leading-none sm:text-4xl">{o.concluded}</p>
            <p className="mt-2 text-sm text-white/55">{o.total} no período</p>
          </div>
          <div className="min-w-0 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <p className="text-sm text-white/65">Ticket médio</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular leading-none">
              {o.ticketCents === null ? '—' : formatBRL(o.ticketCents)}
            </p>
            <p className="mt-2 text-sm text-white/55">Receita {formatBRL(o.revenueCents)}</p>
          </div>
          <div className="min-w-0 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <p className="text-sm text-white/65">Ocupação da agenda</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular leading-none">{fmtPct(o.occupancyPct)}</p>
            <p className="mt-2 text-sm text-white/55">Horas marcadas ÷ horas de trabalho</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Faltas"
          value={fmtPct(o.noShowPct)}
          hint={`${o.noShows} ${o.noShows === 1 ? 'falta' : 'faltas'}`}
          tone={o.noShowPct !== null && o.noShowPct >= 15 ? 'warn' : undefined}
        />
        <Kpi label="Cancelamentos" value={fmtPct(o.cancelPct)} hint={`${o.cancelled} ${o.cancelled === 1 ? 'cancelado' : 'cancelados'}`} />
        <Kpi label="Clientes atendidos" value={String(o.clientsServed)} hint={`${o.newClients} novos`} />
        <Kpi label="Clientes que voltaram" value={fmtPct(o.returnPct)} hint={`${o.returningClients} já tinham vindo antes`} />
        <div className="col-span-2 min-w-0 sm:col-span-1 lg:col-span-1">
          <Kpi label="Reservas online" value={fmtPct(o.onlineSharePct)} hint="Parte do total de horários" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <section aria-label="Serviços mais feitos">
          <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Mais feitos</h2>
          {o.services.length ? (
            <ol className="overflow-hidden rounded-3xl border border-border bg-card">
              {o.services.map((s, i) => (
                <li key={s.id} className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-border')}>
                  <span className="w-5 text-sm font-bold tabular text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  <span className="text-sm tabular text-muted-foreground">{s.count}×</span>
                  <span className="w-24 text-right font-display font-extrabold tabular">{formatBRL(s.revenueCents)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-3xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
              Nenhum atendimento concluído no período.
            </p>
          )}
        </section>
        <section aria-label="Equipe">
          <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Equipe e ocupação</h2>
          {o.members.length ? (
            <ul className="overflow-hidden rounded-3xl border border-border bg-card">
              {o.members.map((m, i) => (
                <li key={m.id} className={cn('space-y-1.5 px-4 py-3.5', i > 0 && 'border-t border-border')}>
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                    <span className="text-sm tabular text-muted-foreground">{m.count} atend.</span>
                    <span className="w-24 text-right font-display font-extrabold tabular">{formatBRL(m.revenueCents)}</span>
                  </div>
                  <Bar pct={m.occupancyPct} />
                  <p className="text-xs text-muted-foreground">
                    {m.occupancyPct === null
                      ? 'Sem horário de trabalho no período'
                      : `${fmtPct(m.occupancyPct)} ocupado · ${formatDuration(m.bookedMinutes)} de ${formatDuration(m.availableMinutes)}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">Ninguém na agenda ainda.</p>
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
          <UserRoundX className="size-5 text-primary" aria-hidden /> {vocab.clients} sem voltar
        </h2>
        <div className="flex w-full gap-2 overflow-x-auto pb-1 scrollbar-none sm:ml-auto sm:w-auto">
          {[30, 60, 90, 180].map((d) => (
            <Chip key={d} active={days === d} onClick={() => setDays(d)}>
              {d}+ dias
            </Chip>
          ))}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : !data?.length ? (
        <EmptyState
          inline
          title="Ninguém sumido"
          description={`Nenhum ${vocab.client.toLowerCase()} está há ${days} dias ou mais sem voltar.`}
        />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card">
          {data.slice(0, 30).map((c, i) => (
            <li key={c.clientId} className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-border')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Última visita {formatDateShort(c.lastVisit)} · há {c.daysAway} dias · {c.visits}{' '}
                  {c.visits === 1 ? 'visita' : 'visitas'}
                </span>
              </span>
              {c.phone ? (
                <Button asChild size="sm" variant="soft">
                  <a
                    href={whatsappLink(c.phone, comebackMessage(c, org.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Chamar ${c.name} no WhatsApp`}
                  >
                    <MessageCircle /> Chamar
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Birthdays() {
  const { org } = useOrg();
  const { data, isLoading } = useBirthdays(30);
  return (
    <section aria-label="Aniversariantes">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
        <Cake className="size-5 text-primary" aria-hidden /> Aniversariantes
        <span className="text-sm font-semibold text-muted-foreground">· próximos 30 dias</span>
      </h2>
      {isLoading ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : !data?.length ? (
        <p className="rounded-3xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
          Ninguém faz aniversário nos próximos 30 dias (ou ainda falta cadastrar a data de nascimento).
        </p>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card">
          {data.map((b, i) => (
            <li key={b.clientId} className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-border')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {b.inDays === 0 ? 'Hoje' : b.inDays === 1 ? 'Amanhã' : `${formatDateShort(b.date)} (em ${b.inDays} dias)`}
                  {b.turns ? ` · faz ${b.turns} anos` : ''}
                </span>
              </span>
              {b.phone ? (
                <Button asChild size="sm" variant="soft">
                  <a
                    href={whatsappLink(b.phone, birthdayMessage(b, org.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Dar parabéns a ${b.name} no WhatsApp`}
                  >
                    <MessageCircle /> Parabéns
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
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
    <div className="mx-auto w-full max-w-7xl space-y-5 px-6 pb-8 pt-5 lg:space-y-6 lg:px-8 lg:pb-10 lg:pt-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Como o negócio está indo</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Relatórios</h1>
      </header>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 scrollbar-none lg:-mx-8 lg:px-8" role="group" aria-label="Período">
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
  );
}
