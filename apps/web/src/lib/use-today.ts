'use client';

import { DEFAULT_TIMEZONE, todayIn, type IsoDate } from '@skedulei/contracts';
import { useAuth } from './auth';
import { useHydrated } from './use-hydrated';

/** "Hoje" no fuso da conta (null durante a hidratação). */
export function useToday(): IsoDate | null {
  const { user } = useAuth();
  return useHydrated() ? todayIn(user?.timezone ?? DEFAULT_TIMEZONE) : null;
}
