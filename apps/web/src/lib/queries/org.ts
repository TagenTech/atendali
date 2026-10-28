'use client';

import type {
  CreateMemberRequest,
  ServiceInput,
  UnitInput,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UpdateServiceRequest,
  UpdateUnitRequest,
} from '@skedulei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orgApi from '@/lib/api/org';
import { orgKeys, useOrg } from '@/lib/org';

export function useServices() {
  const { org } = useOrg();
  return useQuery({ queryKey: orgKeys.services(org.id), queryFn: () => orgApi.listServices(org.id) });
}

export function useMembers(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: orgKeys.members(org.id), queryFn: () => orgApi.listMembers(org.id), enabled });
}

export function useUnits() {
  const { org } = useOrg();
  return useQuery({ queryKey: orgKeys.units(org.id), queryFn: () => orgApi.listUnits(org.id) });
}

/** Mutação do negócio ativo que, no sucesso, atualiza a lista indicada. */
function useOrgMutation<V, R>(fn: (orgId: string, vars: V) => Promise<R>, key: (orgId: string) => readonly unknown[]) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(org.id, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(org.id) }),
  });
}

export const useSaveService = () =>
  useOrgMutation(
    (orgId, v: { id?: string; body: ServiceInput | UpdateServiceRequest }) =>
      v.id ? orgApi.updateService(orgId, v.id, v.body) : orgApi.createService(orgId, v.body as ServiceInput),
    orgKeys.services,
  );

export const useSaveMember = () =>
  useOrgMutation(
    (orgId, v: { id?: string; body: CreateMemberRequest | UpdateMemberRequest }) =>
      v.id ? orgApi.updateMember(orgId, v.id, v.body) : orgApi.createMember(orgId, v.body as CreateMemberRequest),
    orgKeys.members,
  );

export const useRemoveMember = () => useOrgMutation((orgId, id: string) => orgApi.removeMember(orgId, id), orgKeys.members);
export const useResendInvite = () => useOrgMutation((orgId, id: string) => orgApi.resendInvite(orgId, id), orgKeys.members);

export const useSaveUnit = () =>
  useOrgMutation(
    (orgId, v: { id?: string; body: UnitInput | UpdateUnitRequest }) =>
      v.id ? orgApi.updateUnit(orgId, v.id, v.body) : orgApi.createUnit(orgId, v.body as UnitInput),
    orgKeys.units,
  );

/** Nome, módulos etc.: atualiza o negócio ativo e a lista do seletor. */
export function useUpdateOrganization() {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationRequest) => orgApi.updateOrganization(org.id, body),
    onSuccess: (data) => {
      qc.setQueryData(orgKeys.org(org.id), data);
      return qc.invalidateQueries({ queryKey: orgKeys.mine });
    },
  });
}

/** Logo e fundo da página pública: envia ou remove e atualiza o negócio ativo. */
export function useBrandImage() {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: 'logo' | 'cover'; dataUrl: string | null }) =>
      v.dataUrl ? orgApi.setBrandImage(org.id, v.kind, v.dataUrl) : orgApi.removeBrandImage(org.id, v.kind),
    onSuccess: (data) => qc.setQueryData(orgKeys.org(org.id), data),
  });
}
