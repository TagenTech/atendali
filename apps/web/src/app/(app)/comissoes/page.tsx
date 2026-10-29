'use client';

import { formatBRL, formatDateShort, pct, Permission, zonedParts } from '@skedulei/contracts';
import { HandCoins, Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Ledger, LedgerTable, tdClass, thClass, theadClass } from '@/components/ui/ledger';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import * as fin from '@/lib/api/finance';
import { useFieldErrors } from '@/lib/use-field-errors';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCommissions, useFinanceMutation } from '@/lib/queries/finance';
import { useMembers } from '@/lib/queries/org';
import { cn } from '@/lib/utils';

function AdvanceSheet({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const pros = (useMembers().data ?? []).filter((m) => m.bookable || m.status === 'ATIVO');
  const add = useFinanceMutation((orgId, body: Parameters<typeof fin.addAdvance>[1]) => fin.addAdvance(orgId, body));
  const [memberId, setMemberId] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [note, setNote] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();
  return (
    <Sheet open onOpenChange={onOpenChange} title="Registrar vale" description="O valor é descontado no próximo fechamento.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'adv-member': !memberId && 'Escolha a pessoa', 'adv-amount': !amount && 'Informe o valor' }) || !amount) return;
          try {
            await add.mutateAsync({ memberId, amountCents: amount, note: note.trim() || null });
            toast.success('Vale registrado');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <Field label="Profissional" htmlFor="adv-member" error={errors['adv-member']}>
          <select
            id="adv-member"
            value={memberId}
            onChange={(e) => (setMemberId(e.target.value), clear('adv-member'))}
            className="h-13 w-full rounded-2xl border border-input bg-card px-3"
          >
            <option value="">Escolha…</option>
            {pros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor" htmlFor="adv-amount" error={errors['adv-amount']}>
          <MoneyInput id="adv-amount" value={amount} invalid={!!errors['adv-amount']} onChange={(v) => (setAmount(v), clear('adv-amount'))} />
        </Field>
        <Field label="Observação" htmlFor="adv-note">
          <Input id="adv-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" block loading={add.isPending}>
          Registrar
        </Button>
      </form>
    </Sheet>
  );
}

export default function ComissoesPage() {
  const { org, can } = useOrg();
  const all = can(Permission.FINANCE_VIEW);
  const manage = can(Permission.FINANCE_MANAGE);
  const { balances, entries, advances, payouts } = useCommissions(all || can(Permission.COMMISSIONS_OWN));
  const payout = useFinanceMutation((orgId, memberId: string) => fin.createPayout(orgId, memberId));
  const [advancing, setAdvancing] = React.useState(false);
  const [showAllEntries, setShowAllEntries] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const tz = org.timezone;
  const day = (iso: string) => formatDateShort(zonedParts(new Date(iso), tz).date, false);
  const openBalances = balances.data ?? [];
  const dueCents = openBalances.reduce((s, b) => s + b.balanceCents, 0);
  const openComm = openBalances.reduce((s, b) => s + b.commissionsCents, 0);
  const openAdv = openBalances.reduce((s, b) => s + b.advancesCents, 0);

  const payMember = async (memberId: string, memberName: string) => {
    if (confirming !== memberId) return setConfirming(memberId);
    try {
      await payout.mutateAsync(memberId);
      toast.success(`Fechamento de ${memberName} registrado`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-6 pb-8 pt-5 lg:space-y-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{all ? 'Equipe' : 'As suas'}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Comissões</h1>
          </div>
          {manage ? (
            <Button size="sm" variant="outline" className="h-11 shrink-0 px-3.5" onClick={() => setAdvancing(true)}>
              <Plus /> Vale
            </Button>
          ) : null}
        </header>

        {openBalances.length ? (
          <>
            <section className="overflow-hidden rounded-3xl bg-ink-deep px-5 py-5 text-white animate-fade-up sm:px-6 sm:py-6">
              <div className="min-w-0">
                <p className="text-sm text-white/65">A pagar</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular leading-none sm:text-4xl">{formatBRL(dueCents)}</p>
                <p className="mt-2 text-sm text-white/55">
                  {openBalances.length} {openBalances.length === 1 ? 'pessoa' : 'pessoas'} em aberto
                </p>
              </div>
            </section>
            <KpiStrip cols={2}>
              <Kpi label="Comissões em aberto" value={formatBRL(openComm)} />
              <Kpi label="Vales a descontar" value={formatBRL(openAdv)} />
            </KpiStrip>
          </>
        ) : null}

        <section>
          <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Em aberto</h2>
          {balances.isLoading ? (
            <Skeleton className="h-32 rounded-3xl" />
          ) : openBalances.length ? (
            <Ledger>
              <div className="hidden overflow-x-auto lg:block">
                <LedgerTable caption="Comissões em aberto">
                  <thead className={theadClass}>
                    <tr>
                      <th className={thClass}>Pessoa</th>
                      <th className={`${thClass} text-right`}>Comissões</th>
                      <th className={`${thClass} text-right`}>Vales</th>
                      <th className={`${thClass} text-right`}>A pagar</th>
                      {manage ? <th className={thClass} /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {openBalances.map((b) => (
                      <tr key={b.memberId}>
                        <td className={`${tdClass} font-semibold`}>{b.memberName}</td>
                        <td className={`${tdClass} text-right tabular`}>
                          {formatBRL(b.commissionsCents)}
                          <span className="ml-1 text-xs text-muted-foreground">({b.entries})</span>
                        </td>
                        <td className={`${tdClass} text-right tabular`}>{b.advancesCents ? `− ${formatBRL(b.advancesCents)}` : '—'}</td>
                        <td className={`${tdClass} text-right font-display font-extrabold tabular`}>{formatBRL(b.balanceCents)}</td>
                        {manage ? (
                          <td className={`${tdClass} text-right`}>
                            <Button
                              size="sm"
                              variant={confirming === b.memberId ? 'primary' : 'soft'}
                              loading={payout.isPending && confirming === b.memberId}
                              onClick={() => payMember(b.memberId, b.memberName)}
                            >
                              <HandCoins /> {confirming === b.memberId ? `Confirmar ${formatBRL(b.balanceCents)}` : 'Fechar e pagar'}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </LedgerTable>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {openBalances.map((b) => (
                  <div key={b.memberId} className="space-y-3 px-4 py-4">
                    <p className="font-display text-lg font-extrabold">{b.memberName}</p>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Comissões ({b.entries})</dt>
                        <dd className="tabular">{formatBRL(b.commissionsCents)}</dd>
                      </div>
                      {b.advancesCents ? (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Vales</dt>
                          <dd className="tabular">− {formatBRL(b.advancesCents)}</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between border-t border-border pt-1 font-display text-xl font-extrabold">
                        <dt>A pagar</dt>
                        <dd className="tabular">{formatBRL(b.balanceCents)}</dd>
                      </div>
                    </dl>
                    {manage ? (
                      <Button
                        block
                        size="sm"
                        variant={confirming === b.memberId ? 'primary' : 'soft'}
                        loading={payout.isPending && confirming === b.memberId}
                        onClick={() => payMember(b.memberId, b.memberName)}
                      >
                        <HandCoins />{' '}
                        {confirming === b.memberId ? `Confirmar pagamento de ${formatBRL(b.balanceCents)}` : 'Fechar e pagar'}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Ledger>
          ) : (
            <EmptyState title="Nada em aberto" description="As comissões aparecem aqui quando as comandas são pagas." className="py-6" />
          )}
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          <section>
            <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Lançamentos</h2>
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              {(entries.data ?? []).slice(0, showAllEntries ? 100 : 12).map((e, i) => (
                <div key={e.id} className={cn('flex items-center gap-3 px-4 py-3.5 text-sm', i > 0 && 'border-t border-border')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.description}</span>
                    <span className="block truncate text-muted-foreground">
                      {all ? `${e.memberName} · ` : ''}#{e.orderNumber} · {day(e.createdAt)} · {pct(e.bps)} de {formatBRL(e.baseCents)}
                    </span>
                  </span>
                  <span className="text-right tabular">
                    <span className="block font-display font-extrabold">{formatBRL(e.amountCents)}</span>
                    <span className="block text-xs text-muted-foreground">{e.payoutId ? 'paga' : 'em aberto'}</span>
                  </span>
                </div>
              ))}
              {!entries.data?.length ? <p className="p-5 text-center text-muted-foreground">Sem lançamentos.</p> : null}
            </div>
            {(entries.data?.length ?? 0) > 12 ? (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllEntries((v) => !v)}>
                {showAllEntries ? 'Ver menos' : `Ver mais ${Math.min(entries.data!.length, 100) - 12}`}
              </Button>
            ) : null}
          </section>

          <div className="space-y-5 lg:space-y-6">
            <section>
              <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Fechamentos</h2>
              <div className="overflow-hidden rounded-3xl border border-border bg-card">
                {(payouts.data ?? []).map((p, i) => (
                  <div key={p.id} className={cn('flex items-center justify-between gap-3 px-4 py-3.5 text-sm', i > 0 && 'border-t border-border')}>
                    <span>
                      <span className="block font-semibold">{all ? p.memberName : day(p.createdAt)}</span>
                      <span className="block text-muted-foreground">
                        {all ? `${day(p.createdAt)} · ` : ''}
                        {p.entries} comissões{p.advancesCents ? ` · vales ${formatBRL(p.advancesCents)}` : ''}
                      </span>
                    </span>
                    <span className="font-display font-extrabold tabular">{formatBRL(p.totalCents)}</span>
                  </div>
                ))}
                {!payouts.data?.length ? <p className="p-5 text-center text-muted-foreground">Nenhum fechamento ainda.</p> : null}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">Vales</h2>
              <div className="overflow-hidden rounded-3xl border border-border bg-card">
                {(advances.data ?? []).map((a, i) => (
                  <div key={a.id} className={cn('flex items-center justify-between gap-3 px-4 py-3.5 text-sm', i > 0 && 'border-t border-border')}>
                    <span>
                      <span className="block font-semibold">{all ? a.memberName : formatDateShort(a.date, false)}</span>
                      <span className="block text-muted-foreground">
                        {all ? `${formatDateShort(a.date, false)} · ` : ''}
                        {a.note ?? 'Vale'} · {a.payoutId ? 'descontado' : 'em aberto'}
                      </span>
                    </span>
                    <span className="font-display font-extrabold tabular">{formatBRL(a.amountCents)}</span>
                  </div>
                ))}
                {!advances.data?.length ? <p className="p-5 text-center text-muted-foreground">Nenhum vale.</p> : null}
              </div>
            </section>
          </div>
        </div>
      </div>
      {advancing ? <AdvanceSheet onOpenChange={setAdvancing} /> : null}
    </>
  );
}
