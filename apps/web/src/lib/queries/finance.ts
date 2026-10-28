'use client';

import type { OrderDto } from '@agendei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as fin from '@/lib/api/finance';
import { useOrg } from '@/lib/org';

export const finKeys = {
  all: (orgId: string) => ['org', orgId, 'finance'] as const,
  cash: (orgId: string) => ['org', orgId, 'finance', 'cash'] as const,
  cashHistory: (orgId: string) => ['org', orgId, 'finance', 'cash', 'history'] as const,
  orders: (orgId: string, q: object) => ['org', orgId, 'finance', 'orders', q] as const,
  order: (orgId: string, id: string) => ['org', orgId, 'finance', 'order', id] as const,
  commissions: (orgId: string, what: string) => ['org', orgId, 'finance', 'commissions', what] as const,
  summary: (orgId: string, from: string, to: string) => ['org', orgId, 'finance', 'summary', from, to] as const,
};

export function useCash() {
  const { org } = useOrg();
  return useQuery({ queryKey: finKeys.cash(org.id), queryFn: () => fin.currentCash(org.id) });
}

export function useCashHistory(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: finKeys.cashHistory(org.id), queryFn: () => fin.cashHistory(org.id), enabled });
}

export function useOrders(q: { status?: string; date?: string }) {
  const { org } = useOrg();
  return useQuery({ queryKey: finKeys.orders(org.id, q), queryFn: () => fin.listOrders(org.id, q), refetchInterval: 30_000 });
}

export function useOrder(id: string) {
  const { org } = useOrg();
  return useQuery({ queryKey: finKeys.order(org.id, id), queryFn: () => fin.getOrder(org.id, id) });
}

export function useCommissions(enabled = true) {
  const { org } = useOrg();
  const opts = { enabled };
  return {
    balances: useQuery({ queryKey: finKeys.commissions(org.id, 'balances'), queryFn: () => fin.commissionBalances(org.id), ...opts }),
    entries: useQuery({ queryKey: finKeys.commissions(org.id, 'entries'), queryFn: () => fin.commissionEntries(org.id), ...opts }),
    advances: useQuery({ queryKey: finKeys.commissions(org.id, 'advances'), queryFn: () => fin.commissionAdvances(org.id), ...opts }),
    payouts: useQuery({ queryKey: finKeys.commissions(org.id, 'payouts'), queryFn: () => fin.commissionPayouts(org.id), ...opts }),
  };
}

export function useFinanceSummary(from: string | null, to: string | null) {
  const { org } = useOrg();
  return useQuery({
    queryKey: finKeys.summary(org.id, from ?? '-', to ?? '-'),
    queryFn: () => fin.financeSummary(org.id, from!, to!),
    enabled: !!from && !!to,
  });
}

/** Mutação financeira: atualiza caixa, comandas, comissões e também a agenda (status dos atendimentos). */
export function useFinanceMutation<V, R>(fn: (orgId: string, vars: V) => Promise<R>) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(org.id, vars),
    onSuccess: (data) => {
      const order = data as unknown as OrderDto | undefined;
      if (order && typeof order === 'object' && 'items' in order) qc.setQueryData(finKeys.order(org.id, order.id), order);
      return Promise.all([
        qc.invalidateQueries({ queryKey: finKeys.all(org.id) }),
        qc.invalidateQueries({ queryKey: ['org', org.id, 'agenda'] }),
        // Fechar/estornar mexe em estoque, saldos de pacote/clube, vales e pontos.
        qc.invalidateQueries({ queryKey: ['org', org.id, 'retention'] }),
      ]);
    },
  });
}
