'use client';

import { formatBRL, formatDateShort, pct, Permission, zonedParts } from '@skedulei/contracts';
import { HandCoins, Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
          <select id="adv-member" value={memberId} onChange={(e) => (setMemberId(e.target.value), clear('adv-member'))} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3">
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
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const tz = org.timezone;
  const day = (iso: string) => formatDateShort(zonedParts(new Date(iso), tz).date, false);

  return (
    <>
      <PageHeader
        title="Comissões"
        subtitle={all ? 'Equipe' : 'As suas'}
        action={
          manage ? (
            <Button size="sm" variant="outline" className="lg:h-11" onClick={() => setAdvancing(true)}>
              <Plus /> Vale
            </Button>
          ) : null
        }
      />
      <div className="space-y-6 px-5">
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Em aberto</h2>
          {balances.isLoading ? (
            <Skeleton className="h-32 rounded-3xl" />
          ) : balances.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {balances.data.map((b) => (
                <Card key={b.memberId} className="space-y-3">
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
                    <div className="flex justify-between border-t border-border pt-1 font-display text-xl font-black">
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
                      onClick={async () => {
                        if (confirming !== b.memberId) return setConfirming(b.memberId);
                        try {
                          await payout.mutateAsync(b.memberId);
                          toast.success(`Fechamento de ${b.memberName} registrado`);
                        } catch (err) {
                          toast.error(errorText(err));
                        } finally {
                          setConfirming(null);
                        }
                      }}
                    >
                      <HandCoins /> {confirming === b.memberId ? `Confirmar pagamento de ${formatBRL(b.balanceCents)}` : 'Fechar e pagar'}
                    </Button>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState emoji="💸" title="Nada em aberto" description="As comissões aparecem aqui quando as comandas são pagas." className="py-6" />
          )}
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Lançamentos</h2>
            <Card className="divide-y divide-border p-0">
              {(entries.data ?? []).slice(0, 50).map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.description}</span>
                    <span className="block truncate text-muted-foreground">
                      {all ? `${e.memberName} · ` : ''}#{e.orderNumber} · {day(e.createdAt)} · {pct(e.bps)} de {formatBRL(e.baseCents)}
                    </span>
                  </span>
                  <span className="text-right tabular">
                    <span className="block font-semibold">{formatBRL(e.amountCents)}</span>
                    <span className="block text-xs text-muted-foreground">{e.payoutId ? 'paga' : 'em aberto'}</span>
                  </span>
                </div>
              ))}
              {!entries.data?.length ? <p className="p-4 text-center text-muted-foreground">Sem lançamentos.</p> : null}
            </Card>
          </section>

          <div className="space-y-6">
            <section>
              <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Fechamentos</h2>
              <Card className="divide-y divide-border p-0">
                {(payouts.data ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
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
                {!payouts.data?.length ? <p className="p-4 text-center text-muted-foreground">Nenhum fechamento ainda.</p> : null}
              </Card>
            </section>
            <section>
              <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Vales</h2>
              <Card className="divide-y divide-border p-0">
                {(advances.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-semibold">{all ? a.memberName : formatDateShort(a.date, false)}</span>
                      <span className="block text-muted-foreground">
                        {all ? `${formatDateShort(a.date, false)} · ` : ''}
                        {a.note ?? 'Vale'} · {a.payoutId ? 'descontado' : 'em aberto'}
                      </span>
                    </span>
                    <span className="font-semibold tabular">{formatBRL(a.amountCents)}</span>
                  </div>
                ))}
                {!advances.data?.length ? <p className="p-4 text-center text-muted-foreground">Nenhum vale.</p> : null}
              </Card>
            </section>
          </div>
        </div>
      </div>
      {advancing ? <AdvanceSheet onOpenChange={setAdvancing} /> : null}
    </>
  );
}
