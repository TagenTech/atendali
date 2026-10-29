'use client';

import { AUDIT_ACTION_LABEL, AUDIT_GROUP_KEYS, AUDIT_GROUPS, Permission, ROLE_INFO, type AuditAction, type AuditGroup, type Role } from '@skedulei/contracts';
import { ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Ledger, LedgerTable, tdClass, thClass, theadClass } from '@/components/ui/ledger';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useAudit } from '@/lib/queries/audit';
import { cn } from '@/lib/utils';

const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];
// Ações que merecem olho atento: dinheiro que volta, some ou muda de valor.
const WATCH = new Set(['ORDER_CANCELLED', 'ORDER_DISCOUNT', 'PAYMENT_REMOVED', 'ORDER_ITEM_REMOVED', 'PAYABLE_REMOVED', 'RECEIVABLE_REMOVED', 'PAYABLE_REOPENED', 'RECEIVABLE_REOPENED']);

function ActionPill({ action }: { action: AuditAction }) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-bold', WATCH.has(action) ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-muted text-muted-foreground')}>
      {AUDIT_ACTION_LABEL[action]}
    </span>
  );
}

/** Atividade: quem fez o quê no dinheiro (só o dono). Registro que ninguém edita nem apaga. */
export default function AtividadePage() {
  const { can } = useOrg();
  const allowed = can(Permission.AUDIT_VIEW);
  const [group, setGroup] = React.useState<AuditGroup | undefined>();
  const [days, setDays] = React.useState(30);
  const { data, isLoading } = useAudit({ grupo: group, dias: days }, allowed);
  if (!allowed) return null;

  return (
    <>
      <PageHeader title="Atividade" subtitle="Quem fez o quê no dinheiro do negócio" />
      <div className="space-y-4 px-5">
        <p className="flex items-start gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Estornos, descontos, pagamentos desfeitos, caixa, comissões e contas ficam aqui com o nome de quem fez. Só você vê, e ninguém consegue editar ou apagar este registro.
        </p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none" role="group" aria-label="Filtros">
          <Chip active={!group} onClick={() => setGroup(undefined)}>
            Tudo
          </Chip>
          {AUDIT_GROUP_KEYS.map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
              {AUDIT_GROUPS[g].label}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
          {PERIODS.map((p) => (
            <Chip key={p.days} active={days === p.days} onClick={() => setDays(p.days)}>
              {p.label}
            </Chip>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-48 rounded-3xl" />
        ) : !data?.length ? (
          <EmptyState title="Nada por aqui" description="Nenhuma ação desse tipo nos últimos dias." />
        ) : (
          <Ledger>
            <div className="hidden overflow-x-auto lg:block">
              <LedgerTable caption="Registro de atividade">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Quando</th>
                    <th className={thClass}>Ação</th>
                    <th className={thClass}>O que aconteceu</th>
                    <th className={`${thClass} text-right`}>Quem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((e) => (
                    <tr key={e.id}>
                      <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{when.format(new Date(e.createdAt))}</td>
                      <td className={tdClass}>
                        <ActionPill action={e.action} />
                      </td>
                      <td className={`${tdClass} max-w-xl`}>{e.summary}</td>
                      <td className={`${tdClass} text-right text-sm text-muted-foreground`}>
                        {e.actorName}
                        {e.actorRole ? ` · ${ROLE_INFO[e.actorRole as Role]?.label ?? e.actorRole}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </LedgerTable>
            </div>
            <div className="divide-y divide-border lg:hidden">
              {data.map((e) => (
                <article key={e.id} className="flex flex-col gap-1 px-4 py-3.5">
                  <span className="text-xs text-muted-foreground">{when.format(new Date(e.createdAt))}</span>
                  <span className="min-w-0">
                    <span className="mr-2">
                      <ActionPill action={e.action} />
                    </span>
                    <span className="break-words">{e.summary}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {e.actorName}
                    {e.actorRole ? ` · ${ROLE_INFO[e.actorRole as Role]?.label ?? e.actorRole}` : ''}
                  </span>
                </article>
              ))}
            </div>
          </Ledger>
        )}
      </div>
    </>
  );
}
