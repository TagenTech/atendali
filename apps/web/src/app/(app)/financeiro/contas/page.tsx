'use client';

import {
  addMonths,
  formatBRL,
  formatDateShort,
  monthLabel,
  monthOf,
  firstDayOf,
  lastDayOf,
  PAYABLE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  Permission,
  RECEIVABLE_STATUS_LABEL,
  type PayableDto,
  type ReceivableDto,
} from '@skedulei/contracts';
import { ChevronLeft, ChevronRight, ListTree, Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { CategoriesSheet, PayableFormSheet, ReceivableFormSheet, SettleSheet } from '@/components/finance/ledger-sheets';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { errorText } from '@/lib/api/client';
import * as ledger from '@/lib/api/ledger';
import { useOrg } from '@/lib/org';
import { useFinanceMutation } from '@/lib/queries/finance';
import { usePayables, useReceivables } from '@/lib/queries/ledger';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';

type Tab = 'pagar' | 'receber';

const TONE: Record<string, string> = {
  PENDENTE: 'bg-primary-soft text-primary-soft-foreground',
  PAGO: 'bg-success-soft text-success-soft-foreground',
  RECEBIDO: 'bg-success-soft text-success-soft-foreground',
  ATRASADO: 'bg-danger-soft text-danger-soft-foreground',
};

function Status({ status, label }: { status: string; label: string }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TONE[status])}>{label}</span>;
}

/** Detalhe e ações de uma conta a pagar. */
function PayableDetail({ p, manage, onClose, onEdit, onSettle }: { p: PayableDto; manage: boolean; onClose: () => void; onEdit: () => void; onSettle: () => void }) {
  const reopen = useFinanceMutation((orgId, id: string) => ledger.reopenPayable(orgId, id));
  const remove = useFinanceMutation((orgId, v: { id: string; futuras?: boolean }) => ledger.removePayable(orgId, v));
  const [confirming, setConfirming] = React.useState<'one' | 'future' | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={p.description} description={`${formatBRL(p.amountCents)} · vence ${formatDateShort(p.dueDate)}`}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Situação</dt>
          <dd>
            <Status status={p.status} label={PAYABLE_STATUS_LABEL[p.status]} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Categoria</dt>
          <dd>{p.categoryName ?? '—'}</dd>
        </div>
        {p.installment ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Parcela mensal</dt>
            <dd>nº {p.installment}</dd>
          </div>
        ) : null}
        {p.paidDate ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paga em</dt>
            <dd>
              {formatDateShort(p.paidDate)} · {p.paidMethod ? PAYMENT_METHOD_LABEL[p.paidMethod] : ''} · {p.accountName}
            </dd>
          </div>
        ) : null}
        {p.notes ? <p className="rounded-2xl bg-muted p-3">{p.notes}</p> : null}
      </dl>
      {manage ? (
        <div className="mt-5 space-y-2">
          {p.paidDate ? (
            <Button block variant="outline" loading={reopen.isPending} onClick={() => run(() => reopen.mutateAsync(p.id), 'Pagamento desfeito')}>
              Desfazer pagamento
            </Button>
          ) : (
            <>
              <Button block onClick={onSettle}>
                Marcar como paga
              </Button>
              <Button block variant="outline" onClick={onEdit}>
                Editar
              </Button>
            </>
          )}
          {confirming ? (
            <div role="alert" className="space-y-2 rounded-2xl bg-danger-soft p-3 text-danger-soft-foreground">
              <p className="font-semibold">{confirming === 'future' ? 'Apagar esta e as próximas ainda não pagas?' : 'Apagar esta conta?'}</p>
              <div className="flex gap-2">
                <Button variant="danger" loading={remove.isPending} onClick={() => run(() => remove.mutateAsync({ id: p.id, futuras: confirming === 'future' }), 'Conta apagada')}>
                  Apagar
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" size="sm" onClick={() => setConfirming('one')}>
                Apagar
              </Button>
              {p.recurrenceId ? (
                <Button variant="danger" size="sm" onClick={() => setConfirming('future')}>
                  Apagar esta e as próximas
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

function ReceivableDetail({ r, manage, onClose, onSettle }: { r: ReceivableDto; manage: boolean; onClose: () => void; onSettle: () => void }) {
  const reopen = useFinanceMutation((orgId, id: string) => ledger.reopenReceivable(orgId, id));
  const remove = useFinanceMutation((orgId, id: string) => ledger.removeReceivable(orgId, id));
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={r.description} description={`${formatBRL(r.amountCents)} · previsto ${formatDateShort(r.expectedDate)}`}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Situação</dt>
          <dd>
            <Status status={r.status} label={RECEIVABLE_STATUS_LABEL[r.status]} />
          </dd>
        </div>
        {r.feeCents ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxa já descontada</dt>
            <dd className="tabular">{formatBRL(r.feeCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Origem</dt>
          <dd>{r.source === 'COMANDA' ? `Comanda #${r.orderNumber}` : 'Lançamento avulso'}</dd>
        </div>
        {r.categoryName ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Categoria</dt>
            <dd>{r.categoryName}</dd>
          </div>
        ) : null}
        {r.receivedDate ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Recebida em</dt>
            <dd>
              {formatDateShort(r.receivedDate)}
              {r.accountName ? ` · ${r.accountName}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
      {manage ? (
        <div className="mt-5 space-y-2">
          {r.receivedDate ? (
            <Button block variant="outline" loading={reopen.isPending} onClick={() => run(() => reopen.mutateAsync(r.id), 'Baixa desfeita')}>
              Desfazer baixa
            </Button>
          ) : (
            <Button block onClick={onSettle}>
              Dar baixa (já caiu na conta)
            </Button>
          )}
          {r.source === 'AVULSO' ? (
            <Button block variant="danger" loading={remove.isPending} onClick={() => run(() => remove.mutateAsync(r.id), 'Receita apagada')}>
              Apagar
            </Button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export default function ContasPage() {
  const { can } = useOrg();
  const manage = can(Permission.FINANCE_MANAGE);
  const today = useToday();
  const [tab, setTab] = React.useState<Tab>('pagar');
  const [month, setMonth] = React.useState<string | null>(null);
  const [lateOnly, setLateOnly] = React.useState(false);
  const m = month ?? (today ? monthOf(today) : null);
  const q = lateOnly ? { status: 'ATRASADO' } : m ? { from: firstDayOf(m), to: lastDayOf(m) } : {};
  const pay = usePayables(q, !!m && tab === 'pagar');
  const rec = useReceivables(q, !!m && tab === 'receber');

  const [form, setForm] = React.useState<{ kind: 'pay'; p: PayableDto | null } | { kind: 'rec' } | null>(null);
  const [detail, setDetail] = React.useState<{ kind: 'pay'; p: PayableDto } | { kind: 'rec'; r: ReceivableDto } | null>(null);
  const [settle, setSettle] = React.useState<Parameters<typeof SettleSheet>[0]['item'] | null>(null);
  const [categories, setCategories] = React.useState(false);

  const isPay = tab === 'pagar';
  const loading = isPay ? pay.isLoading : rec.isLoading;
  const rows = isPay ? (pay.data?.items ?? []) : (rec.data?.items ?? []);
  const totals = isPay
    ? [
        ['A pagar', pay.data?.totals.pendingCents],
        ['Atrasadas', pay.data?.totals.overdueCents],
        ['Pagas', pay.data?.totals.paidCents],
      ]
    : [
        ['A receber', rec.data?.totals.pendingCents],
        ['Atrasadas', rec.data?.totals.overdueCents],
        ['Recebidas', rec.data?.totals.receivedCents],
      ];

  const view = rows.map((x) =>
    'dueDate' in x
      ? { id: x.id, title: x.description, sub: x.categoryName ?? 'Sem categoria', date: x.dueDate, cents: x.amountCents, status: x.status, label: PAYABLE_STATUS_LABEL[x.status], open: !x.paidDate, pay: x as PayableDto, rec: null }
      : { id: x.id, title: x.description, sub: x.method ? PAYMENT_METHOD_LABEL[x.method] : (x.categoryName ?? 'Avulsa'), date: x.expectedDate, cents: x.amountCents, status: x.status, label: RECEIVABLE_STATUS_LABEL[x.status], open: !x.receivedDate, pay: null, rec: x as ReceivableDto },
  );
  const openRow = (v: (typeof view)[number]) => setDetail(v.pay ? { kind: 'pay', p: v.pay } : { kind: 'rec', r: v.rec! });

  return (
    <>
      <PageHeader
        title="Contas"
        subtitle={isPay ? 'O que sai' : 'O que entra'}
        action={
          manage ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="lg:h-11" aria-label="Categorias" onClick={() => setCategories(true)}>
                <ListTree /> <span className="hidden sm:inline">Categorias</span>
              </Button>
              <Button size="sm" className="lg:h-11 lg:px-4" onClick={() => setForm(isPay ? { kind: 'pay', p: null } : { kind: 'rec' })}>
                <Plus /> {isPay ? 'Conta' : 'Receita'}
              </Button>
            </div>
          ) : null
        }
      />
      <FinanceTabs />
      <div className="space-y-5 px-5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de conta">
          <Chip active={isPay} onClick={() => setTab('pagar')}>
            A pagar
          </Chip>
          <Chip active={!isPay} onClick={() => setTab('receber')}>
            A receber
          </Chip>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <Chip active={lateOnly} onClick={() => setLateOnly((v) => !v)}>
            Só atrasadas
          </Chip>
        </div>
        {lateOnly || !m ? null : (
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Mês anterior" onClick={() => setMonth(addMonths(m, -1))}>
              <ChevronLeft />
            </Button>
            <p className="min-w-40 text-center font-display text-lg font-extrabold first-letter:uppercase" aria-live="polite">
              {monthLabel(m)}
            </p>
            <Button size="icon" variant="outline" aria-label="Próximo mês" onClick={() => setMonth(addMonths(m, 1))}>
              <ChevronRight />
            </Button>
          </div>
        )}
        <KpiStrip>
          {totals.map(([label, cents]) => (
            <Kpi key={label as string} label={label as string} value={formatBRL((cents as number) ?? 0)} />
          ))}
        </KpiStrip>

        {loading || !m ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : !view.length ? (
          <EmptyState
            title={lateOnly ? 'Nada atrasado' : isPay ? 'Nenhuma conta neste mês' : 'Nenhum recebimento neste mês'}
            description={isPay ? 'Cadastre aluguel, fornecedores e impostos para acompanhar o que vence.' : 'Os pagamentos das comandas aparecem aqui sozinhos, na data em que o dinheiro cai.'}
            action={manage ? <Button onClick={() => setForm(isPay ? { kind: 'pay', p: null } : { kind: 'rec' })}>{isPay ? 'Nova conta' : 'Nova receita'}</Button> : undefined}
          />
        ) : (
          <>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-left">
                <thead className="border-b border-border text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">{isPay ? 'Vencimento' : 'Previsto'}</th>
                    <th className="px-5 py-3 font-bold">Descrição</th>
                    <th className="px-5 py-3 font-bold">{isPay ? 'Categoria' : 'Forma'}</th>
                    <th className="px-5 py-3 text-right font-bold">Valor</th>
                    <th className="px-5 py-3 font-bold">Situação</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {view.map((v) => (
                    <tr key={v.id} className="cursor-pointer hover:bg-muted/60" onClick={() => openRow(v)}>
                      <td className="px-5 py-3 tabular">{formatDateShort(v.date)}</td>
                      <td className="px-5 py-3 font-semibold">
                        <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); openRow(v); }}>
                          {v.title}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{v.sub}</td>
                      <td className="px-5 py-3 text-right tabular">{formatBRL(v.cents)}</td>
                      <td className="px-5 py-3">
                        <Status status={v.status} label={v.label} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {manage && v.open ? (
                          <Button
                            size="sm"
                            variant="soft"
                            aria-label={`${isPay ? 'Marcar como paga' : 'Dar baixa'}: ${v.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettle(v.pay ? { kind: 'pay', payable: v.pay } : { kind: 'receive', receivable: v.rec! });
                            }}
                          >
                            {isPay ? 'Pagar' : 'Receber'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="divide-y divide-border p-0 lg:hidden">
              {view.map((v) => (
                <button key={v.id} type="button" onClick={() => openRow(v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{v.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {formatDateShort(v.date, false)} · {v.sub}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular">{formatBRL(v.cents)}</span>
                    <Status status={v.status} label={v.label} />
                  </span>
                </button>
              ))}
            </Card>
          </>
        )}
      </div>

      {form?.kind === 'pay' ? <PayableFormSheet payable={form.p} onOpenChange={(v) => !v && setForm(null)} /> : null}
      {form?.kind === 'rec' ? <ReceivableFormSheet onOpenChange={(v) => !v && setForm(null)} /> : null}
      {detail?.kind === 'pay' && !settle ? (
        <PayableDetail
          p={detail.p}
          manage={manage}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ kind: 'pay', p: detail.p });
            setDetail(null);
          }}
          onSettle={() => setSettle({ kind: 'pay', payable: detail.p })}
        />
      ) : null}
      {detail?.kind === 'rec' && !settle ? (
        <ReceivableDetail r={detail.r} manage={manage} onClose={() => setDetail(null)} onSettle={() => setSettle({ kind: 'receive', receivable: detail.r })} />
      ) : null}
      {settle ? (
        <SettleSheet
          item={settle}
          onOpenChange={(v) => {
            if (!v) {
              setSettle(null);
              setDetail(null);
            }
          }}
        />
      ) : null}
      {categories ? <CategoriesSheet onOpenChange={setCategories} /> : null}
    </>
  );
}
