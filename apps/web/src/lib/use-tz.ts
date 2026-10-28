'use client';

import { DEFAULT_TIMEZONE } from '@agendei/contracts';
import { useAuth } from './auth';

export function useTz(): string {
  return useAuth().user?.timezone ?? DEFAULT_TIMEZONE;
}
