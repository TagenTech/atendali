import type {
  CashFlowDto,
  ClientImportPreview,
  ClientImportReport,
  CreatePayableRequest,
  CreateReceivableRequest,
  DreDto,
  FinanceAccountDto,
  FinanceCategoryDto,
  PayableDto,
  PayablesListDto,
  ReceivableDto,
  ReceivablesListDto,
  SettlePayableRequest,
  SettleReceivableRequest,
  UpdatePayableRequest,
} from '@skedulei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });
const post = <T>(orgId: string, path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', headers: inOrg(orgId), ...(body === undefined ? {} : json(body)) });
const patch = <T>(orgId: string, path: string, body: unknown) => api<T>(path, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });
const del = (orgId: string, path: string) => api<void>(path, { method: 'DELETE', headers: inOrg(orgId) });
const qs = (q: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]).toString();

export const financeCategories = (orgId: string) => api<FinanceCategoryDto[]>('/org/finance/categories', { headers: inOrg(orgId) });
export const createCategory = (orgId: string, body: { name: string; type: 'DESPESA' | 'RECEITA' }) =>
  post<FinanceCategoryDto>(orgId, '/org/finance/categories', body);
export const updateCategory = (orgId: string, v: { id: string; name?: string; active?: boolean }) =>
  patch<FinanceCategoryDto>(orgId, `/org/finance/categories/${v.id}`, { name: v.name, active: v.active });
export const financeAccounts = (orgId: string) => api<FinanceAccountDto[]>('/org/finance/accounts', { headers: inOrg(orgId) });

export const listPayables = (orgId: string, q: { from?: string; to?: string; status?: string }) =>
  api<PayablesListDto>(`/org/finance/payables?${qs(q)}`, { headers: inOrg(orgId) });
export const createPayable = (orgId: string, body: CreatePayableRequest) => post<PayableDto[]>(orgId, '/org/finance/payables', body);
export const updatePayable = (orgId: string, v: { id: string } & UpdatePayableRequest) => {
  const { id, ...body } = v;
  return patch<PayableDto>(orgId, `/org/finance/payables/${id}`, body);
};
export const settlePayable = (orgId: string, v: { id: string } & SettlePayableRequest) => {
  const { id, ...body } = v;
  return post<PayableDto>(orgId, `/org/finance/payables/${id}/pay`, body);
};
export const reopenPayable = (orgId: string, id: string) => post<PayableDto>(orgId, `/org/finance/payables/${id}/reopen`);
export const removePayable = (orgId: string, v: { id: string; futuras?: boolean }) =>
  del(orgId, `/org/finance/payables/${v.id}${v.futuras ? '?futuras=true' : ''}`);

export const listReceivables = (orgId: string, q: { from?: string; to?: string; status?: string }) =>
  api<ReceivablesListDto>(`/org/finance/receivables?${qs(q)}`, { headers: inOrg(orgId) });
export const createReceivable = (orgId: string, body: CreateReceivableRequest) => post<ReceivableDto>(orgId, '/org/finance/receivables', body);
export const settleReceivable = (orgId: string, v: { id: string } & SettleReceivableRequest) => {
  const { id, ...body } = v;
  return post<ReceivableDto>(orgId, `/org/finance/receivables/${id}/receive`, body);
};
export const reopenReceivable = (orgId: string, id: string) => post<ReceivableDto>(orgId, `/org/finance/receivables/${id}/reopen`);
export const removeReceivable = (orgId: string, id: string) => del(orgId, `/org/finance/receivables/${id}`);

export const dre = (orgId: string, from: string, to: string) => api<DreDto>(`/org/finance/dre?${qs({ from, to })}`, { headers: inOrg(orgId) });
export const cashflow = (orgId: string, q: { mode: 'REALIZADO' | 'PROJETADO'; from?: string; to?: string; days?: number; bucket?: string }) =>
  api<CashFlowDto>(`/org/finance/cashflow?${qs(q)}`, { headers: inOrg(orgId) });

export const importClientsPreview = (orgId: string, csv: string) => post<ClientImportPreview>(orgId, '/org/clients/import/preview', { csv });
export const importClients = (orgId: string, csv: string) => post<ClientImportReport>(orgId, '/org/clients/import', { csv });
