'use client';

import { DEFAULT_TIMEZONE } from '@skedulei/contracts';
import { useAuth } from './auth';

export function useTz(): string {
  return useAuth().user?.timezone ?? DEFAULT_TIMEZONE;
}
