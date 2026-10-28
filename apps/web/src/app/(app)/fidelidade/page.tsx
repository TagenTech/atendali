'use client';

import {
  Feature,
  formatBRL,
  formatDateShort,
  GIFT_STATUS_LABEL,
  MEMBERSHIP_STATE_LABEL,
  PACKAGE_STATUS_LABEL,
  Permission,
  type ClientMembershipDto,
  type MembershipPlanDto,
  type PackagePlanDto,
} from '@skedulei/contracts';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { MembershipPlanSheet, PackagePlanSheet } from '@/components/org/plan-sheets';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useClientPackages, useGiftCards, useMembershipPlans, useMemberships, usePackagePlans, useSetMembershipStatus } from '@/lib/queries/retention';
import { cn } from '@/lib/utils';

type Tab = 'pacotes' | 'clube' | 'vales' | 'pontos';

const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: React.ReactNode }) => (
  <span
    className={cn(
      'rounded-full px-2.5 py-0.5 text-xs font-bold',
      tone === 'ok' && 'bg-success-soft text-success-soft-foreground',
      tone === 'warn' && 'bg-warning-soft text-warning-soft-foreground',
      tone === 'off' && 'bg-muted text-muted-foreground',
    )}
  >
    {children}
  </span>
);

const List = ({ loading, empty, children }: { loading: boolean; empty: React.ReactNode; children: React.ReactNode[] }) =>
  loading ? <Skeleton className="h-32 rounded-3xl" /> : !children.length ? <>{empty}</> : <Card className="divide-y divide-border p-0">{children}</Card>;

export default function FidelidadePage() {
  const { can, has, org } = useOrg();
  const canEdit = can(Permission.SERVICES_MANAGE);
  const tabs = ([
    [Feature.PACOTES, 'pacotes', 'Pacotes'],
    [Feature.ASSINATURAS, 'clube', 'Clube'],
    [Feature.VALES, 'vales', 'Vales-presente'],
    [Feature.FIDELIDADE, 'pontos', 'Pontos'],
  ] as const).filter(([f, t]) => has(f) && (t !== 'vales' || can(Permission.CASH_OPERATE)));
  const [picked, setPicked] = React.useState<Tab | null>(null);
  const tab = picked && tabs.some(([, t]) => t === picked) ? picked : tabs[0]?.[1];

  const packagePlans = usePackagePlans(tab === 'pacotes');
  const soldPackages = useClientPackages({ enabled: tab === 'pacotes' });
  const clubPlans = useMembershipPlans(tab === 'clube');
  const memberships = useMemberships({ enabled: tab === 'clube' });
  const gifts = useGiftCards(tab === 'vales');
  const setStatus = useSetMembershipStatus();
  const [pkgSheet, setPkgSheet] = React.useState<{ plan: PackagePlanDto | null; key: number } | null>(null);
  const [memSheet, setMemSheet] = React.useState<{ plan: MembershipPlanDto | null; key: number } | null>(null);

  const changeStatus = async (m: ClientMembershipDto, status: 'ATIVA' | 'PAUSADA' | 'CANCELADA') => {
    try {
      await setStatus.mutateAsync({ id: m.id, status });
      toast.success(status === 'ATIVA' ? 'Assinatura reativada' : status === 'PAUSADA' ? 'Assinatura pausada' : 'Assinatura cancelada');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const addButton =
    canEdit && (tab === 'pacotes' || tab === 'clube') ? (
      <Button
        size="sm"
        className="lg:h-11 lg:px-4"
        onClick={() => (tab === 'pacotes' ? setPkgSheet({ plan: null, key: Date.now() }) : setMemSheet({ plan: null, key: Date.now() }))}
      >
        <Plus /> Novo
      </Button>
    ) : null;

  return (
    <>
      <PageHeader title="Pacotes e clube" action={addButton} />
      <div className="space-y-5 px-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções">
          {tabs.map(([, t, label]) => (
            <Chip key={t} role="tab" aria-selected={tab === t} active={tab === t} onClick={() => setPicked(t)}>
              {label}
            </Chip>
          ))}
        </div>

        {tab === 'pacotes' ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Pacotes à venda</h2>
              <List
                loading={packagePlans.isLoading}
                empty={<EmptyState emoji="🎟️" title="Nenhum pacote" description="Crie pacotes de sessões e venda pela comanda." action={canEdit ? <Button onClick={() => setPkgSheet({ plan: null, key: Date.now() })}>Criar pacote</Button> : undefined} />}
              >
                {(packagePlans.data ?? []).map((p) => (
                  <button key={p.id} type="button" disabled={!canEdit} onClick={() => setPkgSheet({ plan: p, key: Date.now() })} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', !p.active && 'opacity-55')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {p.sessions} × {p.serviceName}
                        {p.validityDays ? ` · ${p.validityDays} dias` : ''}
                        {!p.active ? ' · desativado' : ''}
                      </span>
                    </span>
                    <span className="font-display font-extrabold tabular">{formatBRL(p.priceCents)}</span>
                  </button>
                ))}
              </List>
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Vendidos</h2>
              <List loading={soldPackages.isLoading} empty={<p className="rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground">Nenhum pacote vendido ainda.</p>}>
                {(soldPackages.data ?? []).map((c) => (
                  <Link key={c.id} href={`/clientes/${c.clientId}`} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.clientName}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.planName} · {c.sessionsLeft} de {c.sessionsTotal} restantes{c.expiresAt ? ` · até ${formatDateShort(c.expiresAt)}` : ''}
                      </span>
                    </span>
                    <Pill tone={c.status === 'ATIVO' ? 'ok' : 'off'}>{PACKAGE_STATUS_LABEL[c.status]}</Pill>
                  </Link>
                ))}
              </List>
            </section>
          </div>
        ) : null}

        {tab === 'clube' ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Planos</h2>
              <List
                loading={clubPlans.isLoading}
                empty={<EmptyState emoji="💜" title="Nenhum plano" description="Crie um plano mensal e receba a mensalidade pela comanda." action={canEdit ? <Button onClick={() => setMemSheet({ plan: null, key: Date.now() })}>Criar plano</Button> : undefined} />}
              >
                {(clubPlans.data ?? []).map((p) => (
                  <button key={p.id} type="button" disabled={!canEdit} onClick={() => setMemSheet({ plan: p, key: Date.now() })} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', !p.active && 'opacity-55')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {p.serviceName ?? 'Qualquer serviço'} · {p.sessionsPerMonth ? `${p.sessionsPerMonth} por mês` : 'ilimitado'}
                        {!p.active ? ' · desativado' : ''}
                      </span>
                    </span>
                    <span className="font-display font-extrabold tabular">{formatBRL(p.priceCents)}/mês</span>
                  </button>
                ))}
              </List>
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Assinantes</h2>
              <List loading={memberships.isLoading} empty={<p className="rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground">Ninguém assinou ainda.</p>}>
                {(memberships.data ?? []).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <Link href={`/clientes/${m.clientId}`} className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.clientName}</span>
                      <span className="text-sm text-muted-foreground">
                        {m.planName}
                        {m.paidThrough ? ` · pago até ${formatDateShort(m.paidThrough)}` : ''}
                        {m.sessionsPerMonth ? ` · ${m.sessionsUsedInCycle}/${m.sessionsPerMonth} no mês` : ''}
                      </span>
                    </Link>
                    <Pill tone={m.state === 'EM_DIA' ? 'ok' : m.state === 'VENCIDA' ? 'warn' : 'off'}>{MEMBERSHIP_STATE_LABEL[m.state]}</Pill>
                    {canEdit && m.status !== 'CANCELADA' ? (
                      <Button size="sm" variant="soft" disabled={setStatus.isPending} onClick={() => changeStatus(m, m.status === 'PAUSADA' ? 'ATIVA' : 'PAUSADA')}>
                        {m.status === 'PAUSADA' ? 'Reativar' : 'Pausar'}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </List>
            </section>
          </div>
        ) : null}

        {tab === 'vales' ? (
          <section className="space-y-2">
            <p className="px-1 text-sm text-muted-foreground">Vendidos pela comanda (item “Vale-presente”). O valor só vira receita quando é usado para pagar.</p>
            <List loading={gifts.isLoading} empty={<EmptyState emoji="🎁" title="Nenhum vale vendido" description="Na comanda, adicione “Vale-presente” e receba normalmente." />}>
              {(gifts.data ?? []).map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono font-bold tracking-wider">{g.code}</span>
                    <span className="text-sm text-muted-foreground">
                      {g.buyerName ? `${g.buyerName} · ` : ''}vence {formatDateShort(g.expiresAt)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display font-extrabold tabular">{formatBRL(g.balanceCents)}</span>
                    <span className="text-xs text-muted-foreground tabular">de {formatBRL(g.initialCents)}</span>
                  </span>
                  <Pill tone={g.status === 'ATIVO' ? 'ok' : 'off'}>{GIFT_STATUS_LABEL[g.status]}</Pill>
                </div>
              ))}
            </List>
          </section>
        ) : null}

        {tab === 'pontos' ? (
          <Card className="space-y-2 lg:max-w-xl">
            <h2 className="font-display text-lg font-extrabold">Programa de pontos</h2>
            {org.loyalty.enabled ? (
              <p className="text-muted-foreground">
                {org.loyalty.pointsPerReal} ponto por R$ 1,00 pago. A cada {org.loyalty.redeemPoints} pontos, {formatBRL(org.loyalty.redeemValueCents)} de desconto. O saldo de cada pessoa aparece na ficha dela e na comanda.
              </p>
            ) : (
              <p className="text-muted-foreground">O programa está desligado: ninguém acumula nem resgata pontos.</p>
            )}
            {can(Permission.ORG_MANAGE) ? (
              <Link href="/configuracoes" className="inline-block font-semibold text-primary hover:underline">
                Ajustar regras em Negócio →
              </Link>
            ) : null}
          </Card>
        ) : null}

        {!tab ? <EmptyState emoji="💜" title="Nenhum módulo ligado" description="Ligue pacotes, clube, vales ou pontos em Negócio → Módulos." /> : null}
      </div>
      {pkgSheet ? <PackagePlanSheet key={pkgSheet.key} open onOpenChange={(v) => !v && setPkgSheet(null)} plan={pkgSheet.plan} /> : null}
      {memSheet ? <MembershipPlanSheet key={memSheet.key} open onOpenChange={(v) => !v && setMemSheet(null)} plan={memSheet.plan} /> : null}
    </>
  );
}
