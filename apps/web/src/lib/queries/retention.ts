'use client';

import type {
  CreateMovementRequest,
  MembershipPlanInput,
  MembershipStatus,
  PackagePlanInput,
  ProductInput,
  UpdateMembershipPlanRequest,
  UpdatePackagePlanRequest,
  UpdateProductRequest,
} from '@agendei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as r from '@/lib/api/retention';
import { useOrg } from '@/lib/org';

export const retKeys = {
  all: (orgId: string) => ['org', orgId, 'retention'] as const,
  products: (orgId: string) => ['org', orgId, 'retention', 'products'] as const,
  movements: (orgId: string, productId?: string) => ['org', orgId, 'retention', 'movements', productId ?? ''] as const,
  report: (orgId: string) => ['org', orgId, 'retention', 'report'] as const,
  supplies: (orgId: string, serviceId: string) => ['org', orgId, 'retention', 'supplies', serviceId] as const,
  packagePlans: (orgId: string) => ['org', orgId, 'retention', 'package-plans'] as const,
  clientPackages: (orgId: string, clientId?: string, active?: boolean) => ['org', orgId, 'retention', 'client-packages', clientId ?? '', !!active] as const,
  membershipPlans: (orgId: string) => ['org', orgId, 'retention', 'membership-plans'] as const,
  memberships: (orgId: string, clientId?: string) => ['org', orgId, 'retention', 'memberships', clientId ?? ''] as const,
  giftCards: (orgId: string) => ['org', orgId, 'retention', 'gift-cards'] as const,
  loyalty: (orgId: string, clientId: string) => ['org', orgId, 'retention', 'loyalty', clientId] as const,
  reviews: (orgId: string) => ['org', orgId, 'retention', 'reviews'] as const,
  tv: (orgId: string) => ['org', orgId, 'retention', 'tv'] as const,
};

// ------------------------------------------------------------------ leitura

export function useProducts(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.products(org.id), queryFn: () => r.listProducts(org.id), enabled });
}

export function useStockReport(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.report(org.id), queryFn: () => r.stockReport(org.id), enabled });
}

export function useStockMovements(productId?: string, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.movements(org.id, productId), queryFn: () => r.stockMovements(org.id, productId), enabled });
}

export function useServiceSupplies(serviceId: string | undefined, enabled = true) {
  const { org } = useOrg();
  return useQuery({
    queryKey: retKeys.supplies(org.id, serviceId ?? '-'),
    queryFn: () => r.serviceSupplies(org.id, serviceId!),
    enabled: enabled && !!serviceId,
  });
}

export function usePackagePlans(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.packagePlans(org.id), queryFn: () => r.packagePlans(org.id), enabled });
}

export function useClientPackages(opts: { clientId?: string; active?: boolean; enabled?: boolean } = {}) {
  const { org } = useOrg();
  return useQuery({
    queryKey: retKeys.clientPackages(org.id, opts.clientId, opts.active),
    queryFn: () => r.clientPackages(org.id, { clientId: opts.clientId, active: opts.active }),
    enabled: opts.enabled ?? true,
  });
}

export function useMembershipPlans(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.membershipPlans(org.id), queryFn: () => r.membershipPlans(org.id), enabled });
}

export function useMemberships(opts: { clientId?: string; enabled?: boolean } = {}) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.memberships(org.id, opts.clientId), queryFn: () => r.memberships(org.id, opts.clientId), enabled: opts.enabled ?? true });
}

export function useGiftCards(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.giftCards(org.id), queryFn: () => r.giftCards(org.id), enabled });
}

export function useLoyalty(clientId: string | undefined, enabled = true) {
  const { org } = useOrg();
  return useQuery({
    queryKey: retKeys.loyalty(org.id, clientId ?? '-'),
    queryFn: () => r.loyalty(org.id, clientId!),
    enabled: enabled && !!clientId,
  });
}

export function useReviews(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.reviews(org.id), queryFn: () => r.reviews(org.id), enabled });
}

/** Painel de TV: atualiza sozinho a cada 5 s. */
export function useTvBoard() {
  const { org } = useOrg();
  return useQuery({ queryKey: retKeys.tv(org.id), queryFn: () => r.tvBoard(org.id), refetchInterval: 5_000, refetchIntervalInBackground: true });
}

// ------------------------------------------------------------------ escrita

/** Mutação do negócio ativo; no sucesso, invalida tudo de estoque/retenção (um lançamento mexe em várias telas). */
function useRetMutation<V, R>(fn: (orgId: string, vars: V) => Promise<R>, extraKeys: (orgId: string) => readonly unknown[][] = () => []) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(org.id, vars),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: retKeys.all(org.id) }), ...extraKeys(org.id).map((queryKey) => qc.invalidateQueries({ queryKey }))]),
  });
}

export const useSaveProduct = () =>
  useRetMutation((orgId, v: { id?: string; body: ProductInput | UpdateProductRequest }) =>
    v.id ? r.updateProduct(orgId, v.id, v.body as UpdateProductRequest) : r.createProduct(orgId, v.body as ProductInput),
  );
export const useCreateMovement = () => useRetMutation((orgId, body: CreateMovementRequest) => r.createMovement(orgId, body));
export const useSetSupplies = () =>
  useRetMutation((orgId, v: { serviceId: string; supplies: { productId: string; quantity: number }[] }) => r.setServiceSupplies(orgId, v.serviceId, v.supplies));

export const useSavePackagePlan = () =>
  useRetMutation((orgId, v: { id?: string; body: PackagePlanInput | UpdatePackagePlanRequest }) =>
    v.id ? r.updatePackagePlan(orgId, v.id, v.body as UpdatePackagePlanRequest) : r.createPackagePlan(orgId, v.body as PackagePlanInput),
  );
export const useSaveMembershipPlan = () =>
  useRetMutation((orgId, v: { id?: string; body: MembershipPlanInput | UpdateMembershipPlanRequest }) =>
    v.id ? r.updateMembershipPlan(orgId, v.id, v.body as UpdateMembershipPlanRequest) : r.createMembershipPlan(orgId, v.body as MembershipPlanInput),
  );
export const useSetMembershipStatus = () => useRetMutation((orgId, v: { id: string; status: MembershipStatus }) => r.setMembershipStatus(orgId, v.id, v.status));

export const useAdjustPoints = () => useRetMutation((orgId, v: { clientId: string; points: number; note: string }) => r.adjustPoints(orgId, v.clientId, v));
export const useSetReviewPublished = () => useRetMutation((orgId, v: { id: string; published: boolean }) => r.setReviewPublished(orgId, v.id, v.published));
/** "Chamar" no painel de TV: atualiza a agenda e o painel. */
export function useCallAppointment() {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => r.callAppointment(org.id, id),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['org', org.id, 'agenda'] }), qc.invalidateQueries({ queryKey: retKeys.tv(org.id) })]),
  });
}
export const useRequestReview = () => useRetMutation((orgId, orderId: string) => r.requestReview(orgId, orderId));

export const submitReview = r.submitReview;
export const publicReview = r.publicReview;
