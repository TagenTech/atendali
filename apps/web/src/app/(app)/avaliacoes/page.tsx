'use client';

import { formatRating, Permission } from '@skedulei/contracts';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Kpi, KpiStrip } from '@/components/finance/kpi';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Ledger, LedgerTable, tdClass, thClass, theadClass } from '@/components/ui/ledger';
import { Skeleton } from '@/components/ui/skeleton';
import { Stars } from '@/components/ui/stars';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useReviews, useSetReviewPublished } from '@/lib/queries/retention';
import { cn } from '@/lib/utils';

const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AvaliacoesPage() {
  const { can } = useOrg();
  const { data, isLoading } = useReviews();
  const setPublished = useSetReviewPublished();
  const canModerate = can(Permission.CLIENTS_MANAGE);

  const toggle = async (id: string, published: boolean) => {
    try {
      await setPublished.mutateAsync({ id, published });
      toast.success(published ? 'Voltou para a página pública' : 'Oculta da página pública');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Avaliações" subtitle={data?.summary.count ? `${data.summary.count} no total` : undefined} />
      <div className="space-y-4 px-5">
        {isLoading ? (
          <Skeleton className="h-40 rounded-3xl" />
        ) : !data?.items.length ? (
          <EmptyState inline title="Nenhuma avaliação ainda" description="Depois de fechar uma comanda, peça a avaliação por ali — o link vai pronto para o WhatsApp." />
        ) : (
          <>
            <KpiStrip cols={2}>
              <Kpi label="Média" value={formatRating(data.summary.averageTimes10)} hint={`${data.summary.count} avaliações`} />
              <div className="flex min-w-0 items-center bg-card px-4 py-3.5">
                <Stars value={data.summary.averageTimes10 / 10} />
              </div>
            </KpiStrip>
            <Ledger>
              <div className="hidden overflow-x-auto lg:block">
                <LedgerTable caption="Avaliações">
                  <thead className={theadClass}>
                    <tr>
                      <th className={thClass}>Quando</th>
                      <th className={thClass}>Nome</th>
                      <th className={thClass}>Nota</th>
                      <th className={thClass}>Comentário</th>
                      <th className={thClass}>Atendimento</th>
                      {canModerate ? <th className={thClass} /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((r) => (
                      <tr key={r.id} className={cn(!r.published && 'opacity-60')}>
                        <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{when.format(new Date(r.createdAt))}</td>
                        <td className={`${tdClass} font-semibold`}>{r.clientName || 'Pessoa removida'}</td>
                        <td className={tdClass}>
                          <Stars value={r.rating} />
                        </td>
                        <td className={`${tdClass} max-w-sm truncate text-sm`}>{r.comment || '—'}</td>
                        <td className={`${tdClass} text-sm text-muted-foreground`}>
                          {[r.serviceName, r.memberName ? `com ${r.memberName}` : null, r.published ? null : 'oculta'].filter(Boolean).join(' · ')}
                        </td>
                        {canModerate ? (
                          <td className={`${tdClass} text-right`}>
                            <Button size="sm" variant="ghost" aria-label={r.published ? 'Ocultar da página pública' : 'Mostrar na página pública'} disabled={setPublished.isPending} onClick={() => toggle(r.id, !r.published)}>
                              {r.published ? <Eye /> : <EyeOff />}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </LedgerTable>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {data.items.map((r) => (
                  <article key={r.id} className={cn('space-y-1 px-4 py-3.5', !r.published && 'opacity-60')}>
                    <div className="flex items-center gap-3">
                      <Stars value={r.rating} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.clientName || 'Pessoa removida'}</span>
                      <span className="text-xs text-muted-foreground">{when.format(new Date(r.createdAt))}</span>
                      {canModerate ? (
                        <Button size="sm" variant="ghost" aria-label={r.published ? 'Ocultar da página pública' : 'Mostrar na página pública'} disabled={setPublished.isPending} onClick={() => toggle(r.id, !r.published)}>
                          {r.published ? <Eye /> : <EyeOff />}
                        </Button>
                      ) : null}
                    </div>
                    {r.comment ? <p>{r.comment}</p> : null}
                    <p className="text-sm text-muted-foreground">{[r.serviceName, r.memberName ? `com ${r.memberName}` : null, r.published ? null : 'oculta'].filter(Boolean).join(' · ')}</p>
                  </article>
                ))}
              </div>
            </Ledger>
          </>
        )}
      </div>
    </>
  );
}
