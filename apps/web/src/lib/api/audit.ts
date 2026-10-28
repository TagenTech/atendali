import type { AuditEntryDto, AuditGroup } from '@skedulei/contracts';
import { api } from './client';

export const listAudit = (orgId: string, q: { grupo?: AuditGroup; dias?: number }) => {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  return api<AuditEntryDto[]>(`/org/audit${qs ? `?${qs}` : ''}`, { headers: { 'x-organization-id': orgId } });
};
