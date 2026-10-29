'use client';

import { formatPhone, initials, Permission } from '@skedulei/contracts';
import { ChevronRight, Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ClientSheet } from '@/components/agenda/client-sheet';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useClients } from '@/lib/queries/agenda';

export default function ClientesPage() {
  const { can, vocab } = useOrg();
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const { data, isLoading } = useClients(debounced);
  const [creating, setCreating] = React.useState(false);
  const canEdit = can(Permission.CLIENTS_MANAGE);
  const clients = data ?? [];

  const timer = React.useRef<number | undefined>(undefined);
  const onSearch = (v: string) => {
    setQuery(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebounced(v.trim()), 250);
  };

  return (
    <>
      <PageHeader
        title={vocab.clients}
        subtitle={debounced ? `${clients.length} encontrado(s)` : 'Mais recentes'}
        action={
          canEdit ? (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="lg:h-11 lg:px-4">
                <Link href="/clientes/importar">
                  <Upload /> Importar
                </Link>
              </Button>
              <Button size="sm" className="lg:h-11 lg:px-4" onClick={() => setCreating(true)}>
                <Plus /> Novo
              </Button>
            </div>
          ) : null
        }
      />
      <div className="space-y-4 px-5">
        <Input
          icon={<Search />}
          type="search"
          aria-label={`Buscar ${vocab.clients.toLowerCase()}`}
          placeholder="Nome, celular ou e-mail"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          className="lg:max-w-md"
        />
        {isLoading ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : !clients.length ? (
          <EmptyState
            title={debounced ? 'Ninguém com esse nome' : `Nenhum ${vocab.client.toLowerCase()} ainda`}
            description={debounced ? 'Confira a grafia ou busque pelo celular.' : 'Eles aparecem aqui ao agendar ou ao cadastrar.'}
            action={canEdit && !debounced ? <Button onClick={() => setCreating(true)}>Cadastrar</Button> : undefined}
          />
        ) : (
          <>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-left">
                <thead className="border-b border-border text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Nome</th>
                    <th className="px-5 py-3 font-bold">Celular</th>
                    <th className="px-5 py-3 font-bold">E-mail</th>
                    <th className="px-5 py-3 font-bold">Etiquetas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => router.push(`/clientes/${c.id}`)}>
                      <td className="px-5 py-3 font-semibold">
                        <span className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-extrabold text-primary-soft-foreground">
                            {initials(c.name)}
                          </span>
                          <span className="min-w-0">
                            <Link href={`/clientes/${c.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                              {c.name}
                            </Link>
                            {c.guardianName ? <span className="block text-xs font-normal text-muted-foreground">Resp.: {c.guardianName}</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 tabular">{c.phone ? formatPhone(c.phone) : '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span key={t} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-soft-foreground">
                              {t}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="divide-y divide-border p-0 lg:hidden">
              {clients.map((c) => (
                <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft font-display text-sm font-extrabold text-primary-soft-foreground">
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">{c.guardianName ? `Resp.: ${c.guardianName} · ` : ''}{c.phone ? formatPhone(c.phone) : (c.email ?? 'Sem contato')}</span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
      {creating ? <ClientSheet client={null} onOpenChange={setCreating} onSaved={(c) => router.push(`/clientes/${c.id}`)} /> : null}
    </>
  );
}
