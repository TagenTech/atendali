'use client';

import {
  APPOINTMENT_STATUS_LABEL,
  formatBRL,
  MemberStatus,
  Permission,
  SEGMENT_PRESETS,
  todayIn,
  zonedParts,
} from '@skedulei/contracts';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { STATUS_DOT } from '@/components/agenda/status';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { firstName, greeting, todayLabel } from '@/lib/greeting';
import { useOrg } from '@/lib/org';
import { useAgendaDay } from '@/lib/queries/agenda';
import { useCash, useFinanceSummary } from '@/lib/queries/finance';
import { useMembers, useServices, useUnits } from '@/lib/queries/org';
import { useHydrated } from '@/lib/use-hydrated';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

function dayLine(count: number | null, nextTime: string | null): string {
  if (count === null) return 'Carregando a agenda…';
  if (count === 0) return 'Nenhum horário marcado para hoje';
  if (nextTime) {
    return count === 1 ? `1 horário · próximo às ${nextTime}` : `${count} horários · próximo às ${nextTime}`;
  }
  return count === 1 ? '1 horário hoje · todos já passaram' : `${count} horários hoje · todos já passaram`;
}

function Metric({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: 'default' | 'ok' | 'warn';
}) {
  const body = (
    <>
      <span className="block text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'mt-1 block truncate font-display text-xl font-extrabold leading-none tabular sm:text-2xl',
          tone === 'ok' && 'text-success',
          tone === 'warn' && 'text-warning',
        )}
      >
        {value}
      </span>
      {hint ? <span className="mt-1.5 block truncate text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
  const cls = 'block h-full min-w-0 px-5 py-4';
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:bg-muted/50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Quick({
  href,
  icon: Icon,
  label,
  short,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  short: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-2 text-white transition-colors hover:bg-white/15 sm:flex-none sm:justify-start sm:gap-2 sm:px-4"
    >
      <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
      <span className="truncate text-xs font-bold sm:hidden">{short}</span>
      <span className="hidden text-sm font-bold sm:inline">{label}</span>
    </Link>
  );
}

function Hero() {
  const { user } = useAuth();
  const { org, can, vocab } = useOrg();
  const hydrated = useHydrated();
  const now = useNow();
  const today = hydrated ? todayIn(org.timezone) : null;
  const { data } = useAgendaDay(today);
  const appts = (data?.appointments ?? []).filter((a) => a.status !== 'CANCELADO');
  const upcoming = now ? appts.filter((a) => new Date(a.endsAt).getTime() >= now) : appts;
  const next = upcoming[0];
  const nextTime = next ? zonedParts(new Date(next.startsAt), org.timezone).time : null;
  const count = data ? appts.length : null;
  const name = firstName(user?.name ?? '');
  const hello = hydrated ? greeting().text : 'Olá';
  const date = hydrated ? todayLabel() : '…';
  const actions = [
    can(Permission.AGENDA_OWN) ? (
      <Quick key="agenda" href="/agenda" icon={CalendarDays} label="Abrir agenda" short="Agenda" />
    ) : null,
    can(Permission.CASH_OPERATE) ? (
      <Quick key="caixa" href="/caixa" icon={Wallet} label="Caixa" short="Caixa" />
    ) : null,
    can(Permission.CLIENTS_MANAGE) ? (
      <Quick
        key="client"
        href="/clientes"
        icon={Plus}
        label={`Novo ${vocab.client.toLowerCase()}`}
        short={vocab.client}
      />
    ) : null,
  ].filter(Boolean);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink-deep px-5 py-6 text-white animate-fade-up sm:px-6 sm:py-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/35 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-pink/25 blur-2xl"
      />
      <div className="relative">
        <p className="text-sm font-medium text-white/70">{date}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {hello}, {name}
        </h1>
        <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">{dayLine(count, nextTime)}</p>
        {actions.length ? <div className="mt-5 flex w-full gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

function Glance() {
  const { org, can, vocab } = useOrg();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn(org.timezone) : null;
  const agenda = useAgendaDay(today);
  const day = useFinanceSummary(today, today);
  const month = useFinanceSummary(today ? `${today.slice(0, 8)}01` : null, today);
  const cash = useCash();
  const services = useServices();
  const canTeam = can(Permission.TEAM_VIEW);
  const members = useMembers(canTeam);

  const appts = (agenda.data?.appointments ?? []).filter((a) => a.status !== 'CANCELADO').length;
  const activeServices = services.data?.filter((s) => s.active).length ?? 0;
  const professionals = (members.data ?? []).filter((m) => m.bookable).length;

  const cells: ReactNode[] = [];
  if (can(Permission.AGENDA_OWN)) {
    cells.push(
      <Metric
        key="agenda"
        label="Horários hoje"
        value={agenda.data ? String(appts) : '…'}
        hint={appts === 0 ? 'Dia livre' : undefined}
        href="/agenda"
      />,
    );
  }
  if (can(Permission.FINANCE_VIEW)) {
    cells.push(
      <Metric
        key="day"
        label="Faturado hoje"
        value={day.data ? formatBRL(day.data.revenueCents) : '…'}
        href="/financeiro"
      />,
      <Metric
        key="month"
        label="Faturado no mês"
        value={month.data ? formatBRL(month.data.revenueCents) : '…'}
        href="/financeiro"
      />,
    );
  } else {
    cells.push(
      <Metric
        key="services"
        label={`${vocab.services} ativos`}
        value={services.data ? String(activeServices) : '…'}
        href="/servicos"
      />,
    );
    if (canTeam) {
      cells.push(
        <Metric
          key="team"
          label="Quem atende"
          value={members.data ? String(professionals) : '…'}
          href="/equipe"
        />,
      );
    }
  }
  if (can(Permission.CASH_OPERATE)) {
    const open = !!cash.data;
    cells.push(
      <Metric
        key="cash"
        label="Caixa"
        value={cash.data === undefined ? '…' : open ? 'Aberto' : 'Fechado'}
        hint={open ? `Na gaveta ${formatBRL(cash.data!.expected.drawerCents)}` : 'Abra para receber'}
        href="/caixa"
        tone={open ? 'ok' : 'warn'}
      />,
    );
  }

  if (!cells.length) return null;

  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-3xl border border-border bg-card divide-border',
        cells.length === 1 && 'grid-cols-1',
        cells.length === 2 && 'grid-cols-2 divide-x',
        cells.length === 3 && 'grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0',
        cells.length >= 4 && 'grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0',
      )}
    >
      {cells.map((cell, i) => (
        <div key={i} className="min-w-0">
          {cell}
        </div>
      ))}
    </div>
  );
}

function TodayAgenda() {
  const { org, vocab } = useOrg();
  const hydrated = useHydrated();
  const now = useNow();
  const today = hydrated ? todayIn(org.timezone) : null;
  const { data } = useAgendaDay(today);
  const appts = (data?.appointments ?? []).filter((a) => a.status !== 'CANCELADO');
  const upcoming = appts.filter((a) => !now || new Date(a.endsAt).getTime() >= now);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-lg font-extrabold tracking-tight">Agenda de hoje</h2>
        <Link href="/agenda" className="inline-flex items-center gap-0.5 text-sm font-bold text-primary">
          Abrir
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {upcoming.length ? (
        <ol className="overflow-hidden rounded-3xl border border-border bg-card">
          {upcoming.slice(0, 8).map((a, i) => {
            const time = zonedParts(new Date(a.startsAt), org.timezone).time;
            const next = i === 0;
            return (
              <li key={a.id} className={cn(i > 0 && 'border-t border-border')}>
                <Link
                  href="/agenda"
                  className={cn(
                    'flex items-stretch gap-0 transition-colors hover:bg-muted/50',
                    next && 'bg-pink-soft/40',
                  )}
                >
                  <span
                    className={cn(
                      'relative flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-border py-3.5',
                      next && 'bg-pink-soft',
                    )}
                  >
                    {next ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-pink" /> : null}
                    <span className="font-display text-base font-extrabold tabular leading-none">{time}</span>
                    {next ? (
                      <span className="mt-1 text-[11px] font-bold text-pink-soft-foreground">Agora</span>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.clientName}</span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {a.serviceName} · {a.memberName}
                      </span>
                    </span>
                    <span className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:flex">
                      <span className={cn('size-2 rounded-full', STATUS_DOT[a.status])} />
                      {APPOINTMENT_STATUS_LABEL[a.status]}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center">
          <p className="font-display text-lg font-extrabold">
            {appts.length ? 'Os horários de hoje já passaram' : 'Dia livre por enquanto'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {appts.length
              ? 'Veja o que rolou na agenda ou marque o próximo.'
              : `Quando alguém marcar um ${vocab.service.toLowerCase()}, aparece aqui.`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="primary">
              <Link href="/agenda">
                <Plus /> Marcar horário
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#link-online">
                <Link2 /> Compartilhar link
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Setup() {
  const { org, can, vocab } = useOrg();
  const services = useServices();
  const canTeam = can(Permission.TEAM_VIEW);
  const members = useMembers(canTeam);
  const units = useUnits();

  const activeServices = services.data?.filter((s) => s.active).length ?? 0;
  const team = canTeam ? (members.data ?? []) : [];
  const pending = team.filter((m) => m.status === MemberStatus.CONVIDADO).length;

  const steps = [
    { done: true, title: 'Negócio criado', description: SEGMENT_PRESETS[org.segment].label },
    {
      done: activeServices > 0,
      title: `Cadastrar ${vocab.services.toLowerCase()}`,
      description: activeServices ? `${activeServices} ativo(s)` : `Sem ${vocab.services.toLowerCase()} ainda`,
      href: '/servicos',
    },
    ...(canTeam
      ? [
          {
            done: team.length > 1,
            title: 'Chamar a equipe',
            description: pending ? `${pending} convite(s) aguardando` : 'Convide quem atende e a recepção',
            href: '/equipe',
          },
        ]
      : []),
    ...(can(Permission.ORG_MANAGE)
      ? [
          {
            done: !!units.data?.some((u) => u.street),
            title: 'Completar endereço',
            description: 'Aparece na página de agendamento',
            href: '/configuracoes',
          },
        ]
      : []),
  ];
  const done = steps.filter((s) => s.done).length;
  const left = steps.length - done;
  if (!left) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold tracking-tight">Primeiros passos</h2>
          <span className="text-sm font-semibold tabular text-muted-foreground">
            {done}/{steps.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
        {next ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Próximo: <span className="font-semibold text-foreground">{next.title.toLowerCase()}</span>
          </p>
        ) : null}
      </div>
      <ul>
        {steps.map((s) => {
          const row = (
            <>
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border-2',
                  s.done ? 'border-success bg-success text-white' : 'border-input bg-card',
                )}
              >
                {s.done ? <Check className="size-4" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-semibold', s.done && 'text-muted-foreground')}>{s.title}</span>
                <span className="block text-sm text-muted-foreground">{s.description}</span>
              </span>
              {s.href && !s.done ? <ChevronRight className="size-5 text-muted-foreground" /> : null}
            </>
          );
          return (
            <li key={s.title} className="border-t border-border first:border-t-0">
              {s.href && !s.done ? (
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50">
                  {row}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-5 py-3.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BookingLink() {
  const { org, vocab } = useOrg();
  const hydrated = useHydrated();
  const url = hydrated ? `${window.location.origin}/${org.slug}` : `/${org.slug}`;
  const short = url.replace(/^https?:\/\//, '');

  return (
    <section id="link-online" className="overflow-hidden rounded-3xl bg-primary-soft">
      <div className="px-5 py-5 sm:px-6">
        <p className="font-display text-lg font-extrabold text-primary-soft-foreground">Agendamento online</p>
        <p className="mt-1 text-sm text-primary-soft-foreground/80">
          Coloque na bio do Instagram e no WhatsApp — o {vocab.client.toLowerCase()} marca sozinho.
        </p>
        <p className="mt-4 truncate rounded-2xl border border-primary/15 bg-card px-3 py-2.5 font-mono text-sm">{short}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success('Link copiado');
              } catch {
                toast.error('Não deu para copiar — selecione o link');
              }
            }}
          >
            <Copy /> Copiar link
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`/${org.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Abrir página
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function InicioPage() {
  const { can } = useOrg();
  const canAgenda = can(Permission.AGENDA_OWN);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-6 pb-8 pt-5 lg:space-y-6 lg:px-8 lg:pb-10 lg:pt-8">
      <Hero />
      <Glance />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="space-y-5 lg:space-y-6">
          {canAgenda ? <TodayAgenda /> : null}
          <Setup />
        </div>
        <div className="space-y-5 lg:space-y-6">
          <BookingLink />
        </div>
      </div>
    </div>
  );
}
