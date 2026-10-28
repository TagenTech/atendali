import type {
  AddPaymentRequest,
  AdvanceDto,
  CashMovementRequest,
  CashSessionDto,
  CloseCashRequest,
  CommissionBalanceDto,
  CommissionEntryDto,
  CommissionPayoutDto,
  CreateOrderRequest,
  FinanceSummaryDto,
  OpenCashRequest,
  OrderDto,
  OrderItemInput,
  OrderSummaryDto,
  UpdateOrderRequest,
} from '@agendei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });
const post = <T>(orgId: string, path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', headers: inOrg(orgId), ...(body === undefined ? {} : json(body)) });

export const currentCash = (orgId: string) => api<CashSessionDto | null>('/org/cash/current', { headers: inOrg(orgId) });
export const cashHistory = (orgId: string) => api<CashSessionDto[]>('/org/cash/history', { headers: inOrg(orgId) });
export const openCash = (orgId: string, body: OpenCashRequest) => post<CashSessionDto>(orgId, '/org/cash/open', body);
export const cashMovement = (orgId: string, body: CashMovementRequest) => post<CashSessionDto>(orgId, '/org/cash/movements', body);
export const closeCash = (orgId: string, body: CloseCashRequest) => post<CashSessionDto>(orgId, '/org/cash/close', body);

export const listOrders = (orgId: string, q: { status?: string; date?: string }) =>
  api<OrderSummaryDto[]>(`/org/orders?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`, {
    headers: inOrg(orgId),
  });
export const createOrder = (orgId: string, body: CreateOrderRequest) => post<OrderDto>(orgId, '/org/orders', body);
export const getOrder = (orgId: string, id: string) => api<OrderDto>(`/org/orders/${id}`, { headers: inOrg(orgId) });
export const updateOrder = (orgId: string, id: string, body: UpdateOrderRequest) =>
  api<OrderDto>(`/org/orders/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });
export const addOrderItem = (orgId: string, id: string, body: OrderItemInput) => post<OrderDto>(orgId, `/org/orders/${id}/items`, body);
export const removeOrderItem = (orgId: string, id: string, itemId: string) =>
  api<OrderDto>(`/org/orders/${id}/items/${itemId}`, { method: 'DELETE', headers: inOrg(orgId) });
export const addOrderPayment = (orgId: string, id: string, body: AddPaymentRequest) => post<OrderDto>(orgId, `/org/orders/${id}/payments`, body);
export const removeOrderPayment = (orgId: string, id: string, paymentId: string) =>
  api<OrderDto>(`/org/orders/${id}/payments/${paymentId}`, { method: 'DELETE', headers: inOrg(orgId) });
export const closeOrder = (orgId: string, id: string) => post<OrderDto>(orgId, `/org/orders/${id}/close`);
export const cancelOrder = (orgId: string, id: string) => post<OrderDto>(orgId, `/org/orders/${id}/cancel`);

export const commissionBalances = (orgId: string) => api<CommissionBalanceDto[]>('/org/commissions/balances', { headers: inOrg(orgId) });
export const commissionEntries = (orgId: string) => api<CommissionEntryDto[]>('/org/commissions/entries', { headers: inOrg(orgId) });
export const commissionAdvances = (orgId: string) => api<AdvanceDto[]>('/org/commissions/advances', { headers: inOrg(orgId) });
export const commissionPayouts = (orgId: string) => api<CommissionPayoutDto[]>('/org/commissions/payouts', { headers: inOrg(orgId) });
export const addAdvance = (orgId: string, body: { memberId: string; amountCents: number; note?: string | null }) =>
  post<AdvanceDto>(orgId, '/org/commissions/advances', body);
export const createPayout = (orgId: string, memberId: string) => post<CommissionPayoutDto>(orgId, '/org/commissions/payouts', { memberId });

export const financeSummary = (orgId: string, from: string, to: string) =>
  api<FinanceSummaryDto>(`/org/finance/summary?from=${from}&to=${to}`, { headers: inOrg(orgId) });
