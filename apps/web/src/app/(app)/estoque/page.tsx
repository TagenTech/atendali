'use client';

import { formatBRL, Permission, PRODUCT_KIND_LABEL, STOCK_MOVEMENT_LABEL, STOCK_STATUS_LABEL, type ProductDto, type StockStatus } from '@agendei/contracts';
import { ArrowDownUp, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { Kpi } from '@/components/finance/kpi';
import { PageHeader } from '@/components/layout/page-header';
import { MovementSheet } from '@/components/org/movement-sheet';
import { ProductSheet } from '@/components/org/product-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/lib/org';
import { useProducts, useStockMovements, useStockReport } from '@/lib/queries/retention';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<StockStatus, string> = {
  OK: 'bg-success-soft text-success-soft-foreground',
  BAIXO: 'bg-warning-soft text-warning-soft-foreground',
  ZERADO: 'bg-danger-soft text-danger-soft-foreground',
};

const StatusPill = ({ status }: { status: StockStatus }) => (
  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_TONE[status])}>{STOCK_STATUS_LABEL[status]}</span>
);

const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function EstoquePage() {
  const { can } = useOrg();
  const canEdit = can(Permission.SERVICES_MANAGE);
  const products = useProducts();
  const report = useStockReport();
  const [tab, setTab] = React.useState<'produtos' | 'historico'>('produtos');
  const [query, setQuery] = React.useState('');
  const [onlyLow, setOnlyLow] = React.useState(false);
  const [editing, setEditing] = React.useState<{ product: ProductDto | null; key: number } | null>(null);
  const [moving, setMoving] = React.useState<ProductDto | null>(null);
  const history = useStockMovements(undefined, tab === 'historico');

  const all = products.data ?? [];
  const abc = new Map((report.data?.items ?? []).map((i) => [i.id, i.abc]));
  const q = query.trim().toLowerCase();
  const visible = all.filter((p) => (!onlyLow || p.status !== 'OK') && (!q || p.name.toLowerCase().includes(q)));
  const lowCount = all.filter((p) => p.active && p.status !== 'OK').length;

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle={products.data ? `${all.filter((p) => p.active).length} produtos` : undefined}
        action={
          canEdit ? (
            <Button size="sm" className="lg:h-11 lg:px-4" onClick={() => setEditing({ product: null, key: Date.now() })}>
              <Plus /> Novo
            </Button>
          ) : null
        }
      />
      <div className="space-y-4 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Valor em estoque" value={report.data ? formatBRL(report.data.totalValueCents) : '—'} />
          <Kpi label="Abaixo do mínimo" value={report.data ? String(report.data.belowMinimum) : '—'} />
          <Kpi label="Zerados" value={report.data ? String(report.data.zeroed) : '—'} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={tab === 'produtos'} onClick={() => setTab('produtos')}>
            Produtos
          </Chip>
          <Chip active={tab === 'historico'} onClick={() => setTab('historico')}>
            Movimentações
          </Chip>
          {tab === 'produtos' ? (
            <>
              <Input icon={<Search />} type="search" placeholder="Buscar produto" aria-label="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-52 flex-1 lg:max-w-sm" />
              {lowCount ? (
                <Chip active={onlyLow} count={lowCount} onClick={() => setOnlyLow((v) => !v)}>
                  Repor
                </Chip>
              ) : null}
            </>
          ) : null}
        </div>

        {tab === 'historico' ? (
          history.isLoading ? (
            <Skeleton className="h-40 rounded-3xl" />
          ) : !history.data?.length ? (
            <EmptyState emoji="📦" title="Sem movimentações" description="Entradas, saídas e baixas das comandas aparecem aqui." />
          ) : (
            <Card className="divide-y divide-border p-0">
              {history.data.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {STOCK_MOVEMENT_LABEL[m.kind]}
                      {m.orderNumber ? ` · comanda #${m.orderNumber}` : ''} · {when.format(new Date(m.createdAt))}
                      {m.note ? ` · ${m.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-display font-extrabold tabular', m.quantity < 0 ? 'text-danger' : 'text-success')}>
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground tabular">saldo {m.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </Card>
          )
        ) : products.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : !visible.length ? (
          <EmptyState
            emoji="📦"
            title={q || onlyLow ? 'Nada encontrado' : 'Nenhum produto ainda'}
            description={q || onlyLow ? 'Tente outro filtro.' : 'Cadastre os produtos que vende e os insumos que usa nos atendimentos.'}
            action={!q && !onlyLow && canEdit ? <Button onClick={() => setEditing({ product: null, key: Date.now() })}>Cadastrar</Button> : undefined}
          />
        ) : (
          <>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-left">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Produto</th>
                    <th className="px-5 py-3 font-bold">Tipo</th>
                    <th className="px-5 py-3 text-right font-bold">Saldo</th>
                    <th className="px-5 py-3 text-right font-bold">Custo</th>
                    <th className="px-5 py-3 text-right font-bold">Venda</th>
                    <th className="px-5 py-3 text-center font-bold">Curva</th>
                    <th className="px-5 py-3 font-bold">Situação</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((p) => (
                    <tr key={p.id} className={cn(canEdit && 'cursor-pointer hover:bg-muted/60', !p.active && 'opacity-55')} onClick={() => canEdit && setEditing({ product: p, key: Date.now() })}>
                      <td className="px-5 py-3 font-semibold">
                        {p.name}
                        {!p.active ? <span className="ml-2 text-xs font-bold text-muted-foreground">desativado</span> : null}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{PRODUCT_KIND_LABEL[p.kind]}</td>
                      <td className="px-5 py-3 text-right tabular">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="px-5 py-3 text-right tabular">{formatBRL(p.costCents)}</td>
                      <td className="px-5 py-3 text-right tabular">{p.salePriceCents !== null ? formatBRL(p.salePriceCents) : '—'}</td>
                      <td className="px-5 py-3 text-center font-bold">{abc.get(p.id) ?? '—'}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canEdit ? (
                          <Button size="sm" variant="soft" onClick={(e) => (e.stopPropagation(), setMoving(p))}>
                            <ArrowDownUp /> Lançar
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="divide-y divide-border p-0 lg:hidden">
              {visible.map((p) => (
                <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3', !p.active && 'opacity-55')}>
                  <button type="button" disabled={!canEdit} onClick={() => setEditing({ product: p, key: Date.now() })} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="tabular">
                        {p.quantity} {p.unit}
                      </span>
                      <StatusPill status={p.status} />
                    </span>
                  </button>
                  {canEdit ? (
                    <Button size="sm" variant="soft" aria-label={`Lançar movimento de ${p.name}`} onClick={() => setMoving(p)}>
                      <ArrowDownUp />
                    </Button>
                  ) : null}
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
      {editing ? <ProductSheet key={editing.key} open onOpenChange={(v) => !v && setEditing(null)} product={editing.product} /> : null}
      {moving ? <MovementSheet key={moving.id} open onOpenChange={(v) => !v && setMoving(null)} product={moving} /> : null}
    </>
  );
}
