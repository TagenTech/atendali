'use client';

import { useQuery } from '@tanstack/react-query';
import * as ledger from '@/lib/api/ledger';
import { useOrg } from '@/lib/org';
import { finKeys } from './finance';

const key = (orgId: string, ...rest: unknown[]) => [...finKeys.all(orgId), 'ledger', ...rest] as const;

export function useFinanceCategories() {
  const { org } = useOrg();
  return useQuery({ queryKey: key(org.id, 'categories'), queryFn: () => ledger.financeCategories(org.id) });
}

export function useFinanceAccounts() {
  const { org } = useOrg();
  return useQuery({ queryKey: key(org.id, 'accounts'), queryFn: () => ledger.financeAccounts(org.id) });
}

export function usePayables(q: { from?: string; to?: string; status?: string }, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: key(org.id, 'payables', q), queryFn: () => ledger.listPayables(org.id, q), enabled });
}

export function useReceivables(q: { from?: string; to?: string; status?: string }, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: key(org.id, 'receivables', q), queryFn: () => ledger.listReceivables(org.id, q), enabled });
}

export function useDre(from: string | null, to: string | null) {
  const { org } = useOrg();
  return useQuery({ queryKey: key(org.id, 'dre', from, to), queryFn: () => ledger.dre(org.id, from!, to!), enabled: !!from && !!to });
}

export function useCashflow(q: { mode: 'REALIZADO' | 'PROJETADO'; from?: string | null; to?: string | null; days?: number }, enabled = true) {
  const { org } = useOrg();
  return useQuery({
    queryKey: key(org.id, 'cashflow', q),
    queryFn: () => ledger.cashflow(org.id, { mode: q.mode, from: q.from ?? undefined, to: q.to ?? undefined, days: q.days }),
    enabled,
  });
}
