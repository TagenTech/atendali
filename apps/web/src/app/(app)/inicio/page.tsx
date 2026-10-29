'use client';

import { APPOINTMENT_STATUS_LABEL, formatBRL, MemberStatus, Permission, SEGMENT_PRESETS, todayIn, zonedParts } from '@skedulei/contracts';
import { CalendarDays, Check, ChevronRight, Copy, ExternalLink, Scissors, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { STATUS_DOT } from '@/components/agenda/status';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { firstName, greeting } from '@/lib/greeting';
import { useOrg } from '@/lib/org';
import { useAgendaDay } from '@/lib/queries/agenda';
import { useCash, useFinanceSummary } from '@/lib/queries/finance';
import { useMembers, useServices, useUnits } from '@/lib/queries/org';
import { useHydrated } from '@/lib/use-hydrated';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

function Step({ done, title, description, href }: { done: boolean; title: string; description: string; href?: string }) {
  const body = (
    <>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full border-2', done ? 'border-success bg-success text-white' : 'border-input')}>
        {done ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-semibold', done && 'text-muted-foreground')}>{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      {href ? <ChevronRight className="size-5 text-muted-foreground" /> : null}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-2xl p-3';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-muted')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Stat({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: string; href?: string }) {
  const body = (
    <div className={cn('flex items-center gap-3 px-5 py-4', href && 'transition-colors hover:bg-muted/60')}>
      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-display text-2xl font-extrabold leading-none tabular">{value}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
      </span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function TodayStat() {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn(org.timezone) : null;
  const { data } = useAgendaDay(today);
  const count = (data?.appointments ?? []).filter((a) => a.status !== 'CANCELADO').length;
  return <Stat icon={CalendarDays} label={count === 1 ? 'Horário hoje' : 'Horários hoje'} value={data ? String(count) : '…'} href="/agenda" />;
}

function RevenueStats() {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn(org.timezone) : null;
  const month = useFinanceSummary(today ? `${today.slice(0, 8)}01` : null, today);
  const day = useFinanceSummary(today, today);
  return (
    <>
      <Stat icon={Wallet} label="Faturado hoje" value={day.data ? formatBRL(day.data.revenueCents) : '…'} href="/financeiro" />
      <Stat icon={Wallet} label="Faturado no mês" value={month.data ? formatBRL(month.data.revenueCents) : '…'} href="/financeiro" />
    </>
  );
}

function CashStat() {
  const { data } = useCash();
  const label = data === undefined ? '…' : data ? 'Caixa aberto' : 'Caixa fechado';
  return <Stat icon={Wallet} label={data ? `Na gaveta ${formatBRL(data.expected.drawerCents)}` : 'Abra para receber'} value={label} href="/caixa" />;
}

function TodayAgenda() {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const now = useNow();
  const today = hydrated ? todayIn(org.timezone) : null;
  const { data } = useAgendaDay(today);
  const appts = (data?.appointments ?? []).filter((a) => a.status !== 'CANCELADO');
  const upcoming = appts.filter((a) => !now || new Date(a.endsAt).getTime() >= now);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-extrabold text-foreground">Agenda de hoje · {appts.length}</h2>
        <Link href="/agenda" className="text-sm font-bold text-primary">
          Abrir agenda
        </Link>
      </div>
      <Card className="divide-y divide-border p-0">
        {upcoming.length ? (
          upcoming.slice(0, 8).map((a, i) => (
            <Link key={a.id} href="/agenda" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
              <span className="w-12 shrink-0 font-display font-extrabold tabular">{zonedParts(new Date(a.startsAt), org.timezone).time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {a.clientName}
                  {i === 0 ? <span className="ml-2 rounded-full bg-pink-soft px-2 py-0.5 align-middle text-xs font-bold text-pink-soft-foreground">Próximo</span> : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {a.serviceName} · {a.memberName}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={cn('size-2 rounded-full', STATUS_DOT[a.status])} /> {APPOINTMENT_STATUS_LABEL[a.status]}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-4 py-6 text-center text-muted-foreground">{appts.length ? 'Os horários de hoje já passaram.' : 'Nenhum horário hoje.'}</p>
        )}
      </Card>
    </section>
  );
}

function BookingLink() {
  const { org } = useOrg();
  const hydrated = useHydrated();
  const url = hydrated ? `${window.location.origin}/${org.slug}` : `/${org.slug}`;
  return (
    <Card className="space-y-3 bg-primary-soft">
      <div>
        <p className="font-display text-lg font-extrabold text-primary-soft-foreground">Agendamento online</p>
        <p className="text-sm text-primary-soft-foreground/80">Coloque na bio do Instagram e no WhatsApp: o cliente marca sozinho.</p>
      </div>
      <p className="truncate rounded-xl bg-card px-3 py-2 font-mono text-sm">{url.replace(/^https?:\/\//, '')}</p>
      <div className="flex gap-2">
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
          <Copy /> Copiar
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/${org.slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Abrir
          </a>
        </Button>
      </div>
    </Card>
  );
}

export default function InicioPage() {
  const { user } = useAuth();
  const { org, can, vocab } = useOrg();
  const hydrated = useHydrated();
  const services = useServices();
  const canTeam = can(Permission.TEAM_VIEW);
  const members = useMembers(canTeam);
  const units = useUnits();
  const canAgenda = can(Permission.AGENDA_OWN);
  const canFinance = can(Permission.FINANCE_VIEW);
  const canCash = can(Permission.CASH_OPERATE);

  const activeServices = services.data?.filter((s) => s.active).length ?? 0;
  const team = canTeam ? (members.data ?? []) : [];
  const professionals = team.filter((m) => m.bookable).length;
  const pending = team.filter((m) => m.status === MemberStatus.CONVIDADO).length;
  const hello = hydrated ? greeting() : null;
  const name = firstName(user?.name ?? '');

  const steps = [
    { done: true, title: 'Criar o negócio', description: SEGMENT_PRESETS[org.segment].label },
    { done: activeServices > 0, title: `Cadastrar ${vocab.services.toLowerCase()}`, description: `${activeServices} cadastrado(s)`, href: '/servicos' },
    ...(canTeam
      ? [{ done: team.length > 1, title: 'Chamar a equipe', description: pending ? `${pending} convite(s) aguardando` : 'Convide quem atende e a recepção', href: '/equipe' }]
      : []),
    ...(can(Permission.ORG_MANAGE)
      ? [{ done: !!units.data?.some((u) => u.street), title: 'Completar endereço', description: 'Aparece na página de agendamento', href: '/configuracoes' }]
      : []),
  ];
  const left = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader title={hello ? `${hello.text}, ${name}` : `Olá, ${name}`} subtitle={org.name} />
      <div className="space-y-6 px-5">
        <div className="grid divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {canAgenda ? <TodayStat /> : null}
          {canFinance ? <RevenueStats /> : null}
          {canCash ? <CashStat /> : null}
          {!canFinance ? <Stat icon={Scissors} label={`${vocab.services} ativos`} value={services.data ? String(activeServices) : '…'} href="/servicos" /> : null}
          {!canFinance && canTeam ? <Stat icon={UsersRound} label="Pessoas atendendo" value={members.data ? String(professionals) : '…'} href="/equipe" /> : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {canAgenda ? <TodayAgenda /> : null}
            {left ? (
              <section>
                <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">Primeiros passos · faltam {left}</h2>
                <Card className="p-2">
                  {steps.map((s) => (
                    <Step key={s.title} {...s} />
                  ))}
                </Card>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <BookingLink />
          </div>
        </div>
      </div>
    </>
  );
}
