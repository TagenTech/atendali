'use client';

import { useQuery } from '@tanstack/react-query';
import * as r from '@/lib/api/reports';
import { useOrg } from '@/lib/org';

export const useOverview = (from: string | null, to: string | null) => {
  const { org } = useOrg();
  return useQuery({ queryKey: ['org', org.id, 'reports', 'overview', from, to], queryFn: () => r.overview(org.id, from!, to!), enabled: !!from && !!to, retry: false });
};
export const useInactive = (days: number) => {
  const { org } = useOrg();
  return useQuery({ queryKey: ['org', org.id, 'reports', 'inactive', days], queryFn: () => r.inactive(org.id, days), retry: false });
};
export const useBirthdays = (days: number) => {
  const { org } = useOrg();
  return useQuery({ queryKey: ['org', org.id, 'reports', 'birthdays', days], queryFn: () => r.birthdays(org.id, days), retry: false });
};
