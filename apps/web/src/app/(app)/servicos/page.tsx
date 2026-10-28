'use client';

import { formatBRL, formatDuration, Permission, type ServiceDto } from '@skedulei/contracts';
import { Clock, Globe, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ServiceSheet } from '@/components/org/service-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useServices } from '@/lib/queries/org';
import { cn } from '@/lib/utils';

const price = (s: ServiceDto) => (s.priceCents ? formatBRL(s.priceCents) : 'Gratuito');

export default function ServicosPage() {
  const { can, vocab } = useOrg();
  const { data, isLoading } = useServices();
  const [query, setQuery] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<{ service: ServiceDto | null; key: number } | null>(null);
  const canEdit = can(Permission.SERVICES_MANAGE);

  const all = data ?? [];
  const categories = [...new Set(all.map((s) => s.category).filter((c): c is string => !!c))].sort();
  const q = query.trim().toLowerCase();
  const visible = all.filter((s) => (showInactive || s.active) && (!q || `${s.name} ${s.category ?? ''}`.toLowerCase().includes(q)));
  const groups = Object.entries(
    visible.reduce<Record<string, ServiceDto[]>>((acc, s) => ((acc[s.category ?? 'Sem categoria'] ??= []).push(s), acc), {}),
  );
  const inactiveCount = all.filter((s) => !s.active).length;
  const open = (service: ServiceDto | null) => canEdit && setEditing({ service, key: Date.now() });

  return (
    <>
      <PageHeader
        title={vocab.services}
        subtitle={data ? `${all.length - inactiveCount} ativos` : undefined}
        action={
          canEdit ? (
            <Button onClick={() => open(null)} size="sm" className="lg:h-11 lg:px-4">
              <Plus /> Novo
            </Button>
          ) : null
        }
      />
      <div className="space-y-4 px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            icon={<Search />}
            type="search"
            placeholder={`Buscar ${vocab.services.toLowerCase()}`}
            aria-label={`Buscar ${vocab.services.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-60 flex-1 lg:max-w-sm"
          />
          {inactiveCount ? (
            <Chip active={showInactive} count={inactiveCount} onClick={() => setShowInactive((v) => !v)}>
              Desativados
            </Chip>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : !visible.length ? (
          <EmptyState
            emoji="✂️"
            title={q ? 'Nada encontrado' : `Nenhum ${vocab.service.toLowerCase()} ainda`}
            description={q ? 'Tente outro nome.' : `Cadastre o que você oferece: nome, duração e preço.`}
            action={!q && canEdit ? <Button onClick={() => open(null)}>Cadastrar</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop: tabela densa, clicar na linha abre o painel lateral. */}
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-left">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">{vocab.service}</th>
                    <th className="px-5 py-3 font-bold">Categoria</th>
                    <th className="px-5 py-3 text-right font-bold">Duração</th>
                    <th className="px-5 py-3 text-right font-bold">Preço</th>
                    <th className="px-5 py-3 text-center font-bold">Online</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => open(s)}
                      className={cn(canEdit && 'cursor-pointer hover:bg-muted/60', !s.active && 'opacity-55')}
                    >
                      <td className="px-5 py-3 font-semibold">
                        {canEdit ? (
                          <button type="button" className="text-left hover:underline" onClick={(e) => (e.stopPropagation(), open(s))}>
                            {s.name}
                          </button>
                        ) : (
                          s.name
                        )}
                        {!s.active ? <span className="ml-2 text-xs font-bold text-muted-foreground">desativado</span> : null}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular">{formatDuration(s.durationMinutes)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular">{price(s)}</td>
                      <td className="px-5 py-3 text-center">{s.onlineBooking ? <Globe className="mx-auto size-4 text-success" aria-label="Sim" /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Celular: cartões agrupados por categoria. */}
            <div className="space-y-5 lg:hidden">
              {groups.map(([cat, items]) => (
                <section key={cat}>
                  <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">{cat}</h2>
                  <Card className="divide-y divide-border p-0">
                    {items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => open(s)}
                        disabled={!canEdit}
                        className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', !s.active && 'opacity-55')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.name}</span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="size-3.5" /> {formatDuration(s.durationMinutes)}
                            {!s.active ? ' · desativado' : ''}
                          </span>
                        </span>
                        <span className="font-display font-extrabold tabular">{price(s)}</span>
                      </button>
                    ))}
                  </Card>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
      {editing ? (
        <ServiceSheet
          key={editing.key}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          service={editing.service}
          categories={categories}
        />
      ) : null}
    </>
  );
}
