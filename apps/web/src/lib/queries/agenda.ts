'use client';

import type { ClientInput, CreateAppointmentRequest, CreateBlockRequest, CreateWaitlistRequest, UpdateAppointmentRequest } from '@agendei/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as agendaApi from '@/lib/api/agenda';
import { useOrg } from '@/lib/org';

export const agendaKeys = {
  all: (orgId: string) => ['org', orgId, 'agenda'] as const,
  day: (orgId: string, date: string, days = 1) => ['org', orgId, 'agenda', date, days] as const,
  waitlist: (orgId: string) => ['org', orgId, 'agenda', 'waitlist'] as const,
  slots: (orgId: string, p: object) => ['org', orgId, 'agenda', 'slots', p] as const,
  clients: (orgId: string) => ['org', orgId, 'clients'] as const,
  clientList: (orgId: string, q: string) => ['org', orgId, 'clients', 'list', q] as const,
  client: (orgId: string, id: string) => ['org', orgId, 'clients', id] as const,
};

/** Agenda de `days` dias a partir de `date` (1 = dia, 7 = semana). */
export function useAgendaDay(date: string | null, days = 1) {
  const { org } = useOrg();
  return useQuery({
    queryKey: agendaKeys.day(org.id, date ?? '-', days),
    queryFn: () => agendaApi.agendaDay(org.id, date!, days),
    enabled: !!date,
    placeholderData: keepPreviousData,
    // A recepção e os profissionais mexem ao mesmo tempo: mantém a tela fresca.
    refetchInterval: 30_000,
  });
}

export function useSlots(p: { date: string; serviceId: string; memberId?: string } | null) {
  const { org } = useOrg();
  return useQuery({
    queryKey: agendaKeys.slots(org.id, p ?? {}),
    queryFn: () => agendaApi.agendaSlots(org.id, p!),
    enabled: !!p?.serviceId && !!p.date,
  });
}

export function useClients(q: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: agendaKeys.clientList(org.id, q),
    queryFn: () => agendaApi.listClients(org.id, q),
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: string) {
  const { org } = useOrg();
  return useQuery({ queryKey: agendaKeys.client(org.id, id), queryFn: () => agendaApi.getClient(org.id, id) });
}

/** Qualquer mudança na agenda atualiza a agenda e as fichas de cliente. */
function useAgendaMutation<V, R>(fn: (orgId: string, vars: V) => Promise<R>) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(org.id, vars),
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: agendaKeys.all(org.id) }), qc.invalidateQueries({ queryKey: agendaKeys.clients(org.id) })]),
  });
}

export const useCreateAppointment = () => useAgendaMutation((orgId, body: CreateAppointmentRequest) => agendaApi.createAppointment(orgId, body));
export const useUpdateAppointment = () =>
  useAgendaMutation((orgId, v: { id: string; body: UpdateAppointmentRequest }) => agendaApi.updateAppointment(orgId, v.id, v.body));
export const useCreateBlock = () => useAgendaMutation((orgId, body: CreateBlockRequest) => agendaApi.createBlock(orgId, body));
export const useRemoveBlock = () => useAgendaMutation((orgId, id: string) => agendaApi.removeBlock(orgId, id));
export const useSaveClient = () =>
  useAgendaMutation((orgId, v: { id?: string; body: ClientInput }) =>
    v.id ? agendaApi.updateClient(orgId, v.id, v.body) : agendaApi.createClient(orgId, v.body),
  );
export const useRemoveClient = () => useAgendaMutation((orgId, id: string) => agendaApi.removeClient(orgId, id));

export function useWaitlist(enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: agendaKeys.waitlist(org.id), queryFn: () => agendaApi.listWaitlist(org.id), enabled, refetchInterval: 60_000 });
}
export const useAddWaitlist = () => useAgendaMutation((orgId, body: CreateWaitlistRequest) => agendaApi.addWaitlist(orgId, body));
export const useResolveWaitlist = () => useAgendaMutation((orgId, id: string) => agendaApi.resolveWaitlist(orgId, id));
