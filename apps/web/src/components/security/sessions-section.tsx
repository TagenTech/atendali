'use client';

import { SECURITY_EVENT_LABEL, type SecurityEventType } from '@skedulei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Laptop, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { activity, revokeOtherSessions, revokeSession, sessions } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const WARN: SecurityEventType[] = ['LOGIN_FAIL', 'LOGIN_LOCKED', 'TOKEN_REUSE', 'MFA_FAIL', 'MFA_DISABLED'];

export function SessionsSection() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['security', 'sessions'], queryFn: sessions });
  const refresh = () => qc.invalidateQueries({ queryKey: ['security'] });
  const one = useMutation({ mutationFn: revokeSession, onSuccess: () => (toast('Aparelho desconectado'), refresh()) });
  const others = useMutation({ mutationFn: revokeOtherSessions, onSuccess: () => (toast('Outros aparelhos desconectados'), refresh()) });
  const list = data ?? [];

  return (
    <Card className="space-y-3">
      <p className="font-display font-extrabold">Aparelhos conectados</p>
      {isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl p-2">
              <span className="grid size-10 place-items-center rounded-xl bg-muted">
                {/iPhone|Android|iPad/.test(s.device) ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {s.device}
                  {s.current ? <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-soft-foreground">este aparelho</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Ativo {fmt.format(new Date(s.lastActiveAt))}
                  {s.ip ? ` · ${s.ip}` : ''}
                </p>
              </div>
              {!s.current ? (
                <Button size="sm" variant="ghost" className="text-danger" loading={one.isPending && one.variables === s.id} onClick={() => one.mutate(s.id)}>
                  Sair
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {list.length > 1 ? (
        <Button variant="outline" block loading={others.isPending} onClick={() => others.mutate()}>
          Sair de todos os outros aparelhos
        </Button>
      ) : null}
    </Card>
  );
}

export function ActivitySection() {
  const { data, isPending } = useQuery({ queryKey: ['security', 'activity'], queryFn: activity });
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-display font-extrabold">
        <History className="size-5" /> Atividade recente
      </p>
      {isPending ? (
        <Skeleton className="h-32" />
      ) : data?.length ? (
        <ul className="space-y-2">
          {data.slice(0, 15).map((e) => (
            <li key={e.id} className="flex items-start gap-3 text-sm">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', WARN.includes(e.type) ? 'bg-danger' : 'bg-success')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{SECURITY_EVENT_LABEL[e.type]}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt.format(new Date(e.createdAt))} · {e.device}
                  {e.ip ? ` · ${e.ip}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
      )}
      <p className="text-xs text-muted-foreground">Não reconhece algo? Troque a senha e saia dos outros aparelhos.</p>
    </Card>
  );
}
