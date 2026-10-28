'use client';

import type { Feature, OrganizationDto, OrganizationSummaryDto, Permission, Vocabulary } from '@agendei/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { setActiveOrganization } from './api/client';
import * as orgApi from './api/org';

const KEY = 'agendei_org';
const listeners = new Set<() => void>();

function readStoredOrg(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Negócio escolhido por último neste aparelho (sobrevive a recarregar). */
function useStoredOrg(): string | null {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readStoredOrg,
    () => null,
  );
}

function storeOrg(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* modo privado: vale só nesta aba */
  }
  listeners.forEach((l) => l());
}

export const orgKeys = {
  mine: ['organizations'] as const,
  org: (id: string) => ['org', id] as const,
  units: (id: string) => ['org', id, 'units'] as const,
  members: (id: string) => ['org', id, 'members'] as const,
  services: (id: string) => ['org', id, 'services'] as const,
};

interface OrgContextValue {
  /** Negócios em que a pessoa está ativa. */
  orgs: OrganizationSummaryDto[];
  org: OrganizationDto;
  switchOrg: (id: string) => void;
  can: (p: Permission) => boolean;
  has: (f: Feature) => boolean;
  vocab: Vocabulary;
}

const OrgContext = React.createContext<OrgContextValue | null>(null);

export type OrgState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'none' }
  | { status: 'ready'; value: OrgContextValue };

/** Carrega os negócios da conta e o ativo. `none` = conta sem negócio (vai para o onboarding). */
export function useOrgState(): OrgState {
  const stored = useStoredOrg();
  const mine = useQuery({ queryKey: orgKeys.mine, queryFn: orgApi.myOrganizations });
  const list = mine.data;
  const activeId = list?.find((o) => o.id === stored)?.id ?? list?.[0]?.id ?? null;
  // Antes das queries filhas rodarem: as chamadas sem id explícito também vão para este negócio.
  setActiveOrganization(activeId);
  const current = useQuery({
    queryKey: orgKeys.org(activeId ?? '-'),
    queryFn: () => orgApi.getOrganization(activeId!),
    enabled: !!activeId,
  });

  const org = current.data;
  const value = React.useMemo<OrgContextValue | null>(
    () =>
      org && list
        ? {
            orgs: list,
            org,
            switchOrg: storeOrg,
            can: (p) => org.me.permissions.includes(p),
            has: (f) => org.features.includes(f),
            vocab: org.vocabulary,
          }
        : null,
    [org, list],
  );

  if (mine.isError || current.isError) {
    return { status: 'error', retry: () => void (mine.isError ? mine.refetch() : current.refetch()) };
  }
  if (list && list.length === 0) return { status: 'none' };
  return value ? { status: 'ready', value } : { status: 'loading' };
}

export function OrgProvider({ value, children }: { value: OrgContextValue; children: React.ReactNode }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error('useOrg precisa estar dentro de <OrgProvider>');
  return ctx;
}

/** Depois de criar ou entrar num negócio: recarrega a lista e já deixa ele ativo. */
export function useActivateOrg() {
  const qc = useQueryClient();
  return React.useCallback(
    async (id: string) => {
      storeOrg(id);
      await qc.invalidateQueries({ queryKey: orgKeys.mine });
    },
    [qc],
  );
}
