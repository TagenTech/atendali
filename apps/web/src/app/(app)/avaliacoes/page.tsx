'use client';

import { formatRating, Permission } from '@agendei/contracts';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
          <EmptyState emoji="⭐" title="Nenhuma avaliação ainda" description="Depois de fechar uma comanda, peça a avaliação por ali — o link vai pronto para o WhatsApp." />
        ) : (
          <>
            <Card className="flex items-center gap-4 lg:max-w-sm">
              <span className="font-display text-4xl font-black tabular">{formatRating(data.summary.averageTimes10)}</span>
              <span>
                <Stars value={data.summary.averageTimes10 / 10} />
                <span className="block text-sm text-muted-foreground">{data.summary.count} avaliações publicadas</span>
              </span>
            </Card>
            <Card className="divide-y divide-border p-0">
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
            </Card>
          </>
        )}
      </div>
    </>
  );
}
