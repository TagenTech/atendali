import type { Birthday, InactiveClient, ReportOverview } from '@skedulei/contracts';
import { api } from './client';

const inOrg = (orgId: string) => ({ headers: { 'x-organization-id': orgId } });
export const overview = (orgId: string, from: string, to: string) => api<ReportOverview>(`/org/reports/overview?from=${from}&to=${to}`, inOrg(orgId));
export const inactive = (orgId: string, dias: number) => api<InactiveClient[]>(`/org/reports/inactive?dias=${dias}`, inOrg(orgId));
export const birthdays = (orgId: string, dias: number) => api<Birthday[]>(`/org/reports/birthdays?dias=${dias}`, inOrg(orgId));
