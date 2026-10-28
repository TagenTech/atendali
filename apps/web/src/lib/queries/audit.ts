'use client';

import type { AuditGroup } from '@skedulei/contracts';
import { useQuery } from '@tanstack/react-query';
import * as a from '@/lib/api/audit';
import { useOrg } from '@/lib/org';

export function useAudit(q: { grupo?: AuditGroup; dias: number }, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: ['org', org.id, 'audit', q.grupo ?? 'TODOS', q.dias], queryFn: () => a.listAudit(org.id, q), enabled, retry: false });
}
