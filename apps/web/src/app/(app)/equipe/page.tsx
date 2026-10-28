'use client';

import { formatPhone, initials, MEMBER_STATUS_LABEL, MemberStatus, Permission, ROLE_INFO, type MemberDto } from '@agendei/contracts';
import { CalendarCheck2, Plus } from 'lucide-react';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { MemberSheet, memberColor } from '@/components/org/member-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useMembers } from '@/lib/queries/org';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<MemberStatus, string> = {
  ATIVO: 'bg-success-soft text-success-soft-foreground',
  CONVIDADO: 'bg-warning-soft text-warning-soft-foreground',
  SEM_ACESSO: 'bg-muted text-muted-foreground',
};

function Avatar({ m }: { m: MemberDto }) {
  return (
    <span style={memberColor(m.color)} className="grid size-11 shrink-0 place-items-center rounded-2xl font-display font-black">
      {initials(m.name)}
    </span>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  return <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_TONE[status])}>{MEMBER_STATUS_LABEL[status]}</span>;
}

export default function EquipePage() {
  const { can } = useOrg();
  const { data, isLoading } = useMembers();
  const [editing, setEditing] = React.useState<{ member: MemberDto | null; key: number } | null>(null);
  const canEdit = can(Permission.TEAM_MANAGE);
  const open = (member: MemberDto | null) => canEdit && setEditing({ member, key: Date.now() });
  const members = data ?? [];
  const bookable = members.filter((m) => m.bookable).length;

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle={data ? `${members.length} pessoas · ${bookable} atendem` : undefined}
        action={
          canEdit ? (
            <Button size="sm" className="lg:h-11 lg:px-4" onClick={() => open(null)}>
              <Plus /> Adicionar
            </Button>
          ) : null
        }
      />
      <div className="px-5">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-18 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-left">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Pessoa</th>
                    <th className="px-5 py-3 font-bold">Perfil</th>
                    <th className="hidden px-5 py-3 font-bold xl:table-cell">Contato</th>
                    <th className="px-5 py-3 font-bold">Agenda</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <tr key={m.id} onClick={() => open(m)} className={cn(canEdit && 'cursor-pointer hover:bg-muted/60')}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <Avatar m={m} />
                          <span className="font-semibold">
                            {m.name}
                            {m.isMe ? <span className="ml-1.5 text-xs font-bold text-muted-foreground">(você)</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">{ROLE_INFO[m.role].label}</td>
                      <td className="hidden px-5 py-3 text-sm text-muted-foreground xl:table-cell">
                        <span className="block">{m.email ?? '—'}</span>
                        {m.phone ? <span className="block">{formatPhone(m.phone)}</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        {m.bookable ? (
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                            <CalendarCheck2 className="size-4" /> Atende
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="divide-y divide-border p-0 lg:hidden">
              {members.map((m) => (
                <button key={m.id} type="button" disabled={!canEdit} onClick={() => open(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Avatar m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {m.name}
                      {m.isMe ? <span className="ml-1 text-xs text-muted-foreground">(você)</span> : null}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {ROLE_INFO[m.role].label}
                      {m.bookable ? ' · atende' : ''}
                    </span>
                  </span>
                  <StatusBadge status={m.status} />
                </button>
              ))}
            </Card>
          </>
        )}
      </div>
      {editing ? <MemberSheet key={editing.key} open onOpenChange={(v) => !v && setEditing(null)} member={editing.member} /> : null}
    </>
  );
}
