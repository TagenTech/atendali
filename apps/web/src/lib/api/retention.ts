import type {
  AppointmentDto,
  ClientMembershipDto,
  ClientPackageDto,
  CreateMovementRequest,
  GiftCardDto,
  LoyaltyBalanceDto,
  MembershipPlanDto,
  MembershipPlanInput,
  MembershipStatus,
  OrderDto,
  PackagePlanDto,
  PackagePlanInput,
  ProductDto,
  ProductInput,
  PublicReviewInfoDto,
  ReviewRequestDto,
  ReviewsDto,
  ServiceSupplyDto,
  StockMovementDto,
  StockReportDto,
  SubmitReviewRequest,
  TvBoardDto,
  UpdateMembershipPlanRequest,
  UpdatePackagePlanRequest,
  UpdateProductRequest,
} from '@agendei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });
const get = <T>(orgId: string, path: string) => api<T>(path, { headers: inOrg(orgId) });
const send = <T>(orgId: string, method: 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown) =>
  api<T>(path, { method, headers: inOrg(orgId), ...(body === undefined ? {} : json(body)) });
const qs = (q: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

// estoque
export const listProducts = (orgId: string) => get<ProductDto[]>(orgId, '/org/stock/products');
export const createProduct = (orgId: string, body: ProductInput) => send<ProductDto>(orgId, 'POST', '/org/stock/products', body);
export const updateProduct = (orgId: string, id: string, body: UpdateProductRequest) => send<ProductDto>(orgId, 'PATCH', `/org/stock/products/${id}`, body);
export const stockMovements = (orgId: string, productId?: string) => get<StockMovementDto[]>(orgId, `/org/stock/movements${qs({ productId })}`);
export const createMovement = (orgId: string, body: CreateMovementRequest) => send<ProductDto>(orgId, 'POST', '/org/stock/movements', body);
export const stockReport = (orgId: string) => get<StockReportDto>(orgId, '/org/stock/report');
export const serviceSupplies = (orgId: string, serviceId: string) => get<ServiceSupplyDto[]>(orgId, `/org/stock/services/${serviceId}/supplies`);
export const setServiceSupplies = (orgId: string, serviceId: string, supplies: { productId: string; quantity: number }[]) =>
  send<ServiceSupplyDto[]>(orgId, 'PUT', `/org/stock/services/${serviceId}/supplies`, { supplies });

// pacotes
export const packagePlans = (orgId: string) => get<PackagePlanDto[]>(orgId, '/org/package-plans');
export const createPackagePlan = (orgId: string, body: PackagePlanInput) => send<PackagePlanDto>(orgId, 'POST', '/org/package-plans', body);
export const updatePackagePlan = (orgId: string, id: string, body: UpdatePackagePlanRequest) => send<PackagePlanDto>(orgId, 'PATCH', `/org/package-plans/${id}`, body);
export const clientPackages = (orgId: string, q: { clientId?: string; active?: boolean }) =>
  get<ClientPackageDto[]>(orgId, `/org/client-packages${qs({ clientId: q.clientId, ativos: q.active ? '1' : undefined })}`);

// clube
export const membershipPlans = (orgId: string) => get<MembershipPlanDto[]>(orgId, '/org/membership-plans');
export const createMembershipPlan = (orgId: string, body: MembershipPlanInput) => send<MembershipPlanDto>(orgId, 'POST', '/org/membership-plans', body);
export const updateMembershipPlan = (orgId: string, id: string, body: UpdateMembershipPlanRequest) =>
  send<MembershipPlanDto>(orgId, 'PATCH', `/org/membership-plans/${id}`, body);
export const memberships = (orgId: string, clientId?: string) => get<ClientMembershipDto[]>(orgId, `/org/memberships${qs({ clientId })}`);
export const setMembershipStatus = (orgId: string, id: string, status: MembershipStatus) =>
  send<ClientMembershipDto>(orgId, 'PATCH', `/org/memberships/${id}`, { status });

// vales
export const giftCards = (orgId: string) => get<GiftCardDto[]>(orgId, '/org/gift-cards');
export const lookupGiftCard = (orgId: string, code: string) => get<GiftCardDto>(orgId, `/org/gift-cards/lookup${qs({ code })}`);

// fidelidade
export const loyalty = (orgId: string, clientId: string) => get<LoyaltyBalanceDto>(orgId, `/org/loyalty/${clientId}`);
export const adjustPoints = (orgId: string, clientId: string, body: { points: number; note: string }) =>
  send<LoyaltyBalanceDto>(orgId, 'POST', `/org/loyalty/${clientId}/adjust`, body);
export const redeemPoints = (orgId: string, orderId: string, points: number) => send<OrderDto>(orgId, 'POST', `/org/orders/${orderId}/redeem`, { points });

// avaliações
export const reviews = (orgId: string) => get<ReviewsDto>(orgId, '/org/reviews');
export const setReviewPublished = (orgId: string, id: string, published: boolean) => send<unknown>(orgId, 'PATCH', `/org/reviews/${id}`, { published });
export const requestReview = (orgId: string, orderId: string) => send<ReviewRequestDto>(orgId, 'POST', `/org/orders/${orderId}/review-request`);
export const publicReview = (token: string) => api<PublicReviewInfoDto>(`/public/reviews/${encodeURIComponent(token)}`);
export const submitReview = (token: string, body: SubmitReviewRequest) =>
  api<void>(`/public/reviews/${encodeURIComponent(token)}`, { method: 'POST', ...json(body) });

// painel de TV e chamada
export const tvBoard = (orgId: string) => get<TvBoardDto>(orgId, '/org/tv');
export const callAppointment = (orgId: string, id: string) => send<AppointmentDto>(orgId, 'POST', `/org/appointments/${id}/call`);
