import type {
  AgendaDayDto,
  AppointmentDto,
  BlockDto,
  ClientDetailDto,
  ClientDto,
  ClientInput,
  CreateAppointmentRequest,
  CreateBlockRequest,
  CreateWaitlistRequest,
  PortalBookingDto,
  PortalSessionDto,
  PublicBookingDto,
  PublicBookingRequest,
  PublicGroupBookingDto,
  PublicGroupBookingRequest,
  SequenceSlotsDto,
  RescheduleRequest,
  PublicOrgDto,
  SlotsDto,
  UpdateAppointmentRequest,
  WaitlistEntryDto,
} from '@skedulei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });

export const agendaDay = (orgId: string, date: string, days = 1) =>
  api<AgendaDayDto>(`/org/agenda?date=${date}${days > 1 ? `&days=${days}` : ''}`, { headers: inOrg(orgId) });
export const agendaSlots = (orgId: string, p: { date: string; serviceId: string; memberId?: string }) =>
  api<SlotsDto>(`/org/agenda/slots?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`, {
    headers: inOrg(orgId),
  });
export const createAppointment = (orgId: string, body: CreateAppointmentRequest) =>
  api<AppointmentDto>('/org/appointments', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateAppointment = (orgId: string, id: string, body: UpdateAppointmentRequest) =>
  api<AppointmentDto>(`/org/appointments/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });
export const createBlock = (orgId: string, body: CreateBlockRequest) =>
  api<BlockDto>('/org/blocks', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const removeBlock = (orgId: string, id: string) => api<void>(`/org/blocks/${id}`, { method: 'DELETE', headers: inOrg(orgId) });

export const listClients = (orgId: string, q = '') =>
  api<ClientDto[]>(`/org/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`, { headers: inOrg(orgId) });
export const getClient = (orgId: string, id: string) => api<ClientDetailDto>(`/org/clients/${id}`, { headers: inOrg(orgId) });
export const createClient = (orgId: string, body: ClientInput) =>
  api<ClientDto>('/org/clients', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateClient = (orgId: string, id: string, body: Partial<ClientInput>) =>
  api<ClientDto>(`/org/clients/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });
export const removeClient = (orgId: string, id: string) => api<void>(`/org/clients/${id}`, { method: 'DELETE', headers: inOrg(orgId) });

// Página pública (sem login)
export const publicPage = (slug: string) => api<PublicOrgDto>(`/public/orgs/${encodeURIComponent(slug)}`);
export const publicSlots = (slug: string, p: { date: string; serviceId: string; memberId?: string }) =>
  api<SlotsDto>(
    `/public/orgs/${encodeURIComponent(slug)}/slots?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`,
  );
export const publicBook = (slug: string, body: PublicBookingRequest) =>
  api<PublicBookingDto>(`/public/orgs/${encodeURIComponent(slug)}/bookings`, { method: 'POST', ...json(body) });
export const publicSequence = (slug: string, date: string, serviceIds: string[]) =>
  api<SequenceSlotsDto>(`/public/orgs/${encodeURIComponent(slug)}/slots/sequence?${new URLSearchParams({ date, serviceIds: serviceIds.join(',') })}`);
export const publicBookGroup = (slug: string, body: PublicGroupBookingRequest) =>
  api<PublicGroupBookingDto>(`/public/orgs/${encodeURIComponent(slug)}/bookings/group`, { method: 'POST', ...json(body) });
export const publicGroup = (token: string) => api<PublicGroupBookingDto>(`/public/bookings/${encodeURIComponent(token)}/group`);
export const publicGroupCancel = (token: string, itemId?: string) =>
  api<PublicGroupBookingDto>(`/public/bookings/${encodeURIComponent(token)}/group/cancel`, { method: 'POST', ...json(itemId ? { itemId } : {}) });
export const publicGroupConfirm = (token: string, itemId?: string) =>
  api<PublicGroupBookingDto>(`/public/bookings/${encodeURIComponent(token)}/group/confirm`, { method: 'POST', ...json(itemId ? { itemId } : {}) });
export const publicGroupReschedule = (token: string, body: RescheduleRequest) =>
  api<PublicGroupBookingDto>(`/public/bookings/${encodeURIComponent(token)}/group/reschedule`, { method: 'POST', ...json(body) });
export const publicBooking = (token: string) => api<PublicBookingDto>(`/public/bookings/${encodeURIComponent(token)}`);
export const publicCancel = (token: string) => api<PublicBookingDto>(`/public/bookings/${encodeURIComponent(token)}/cancel`, { method: 'POST' });
export const publicReschedule = (token: string, body: RescheduleRequest) =>
  api<PublicBookingDto>(`/public/bookings/${encodeURIComponent(token)}/reschedule`, { method: 'POST', ...json(body) });

// "Minhas reservas": código no e-mail cadastrado → sessão curta → ver, cancelar e remarcar
const portal = (slug: string) => `/public/orgs/${encodeURIComponent(slug)}/my-bookings`;
export const portalCode = (slug: string, phone: string) => api<{ sent: true }>(`${portal(slug)}/code`, { method: 'POST', ...json({ phone }) });
export const portalVerify = (slug: string, phone: string, code: string) => api<PortalSessionDto>(`${portal(slug)}/verify`, { method: 'POST', ...json({ phone, code }) });
export const portalList = (slug: string, portalToken: string) => api<PortalBookingDto[]>(portal(slug), { portalToken });
export const portalCancel = (slug: string, portalToken: string, id: string) => api<{ ok: true }>(`${portal(slug)}/${id}/cancel`, { method: 'POST', portalToken });
export const portalReschedule = (slug: string, portalToken: string, id: string, body: RescheduleRequest) =>
  api<{ ok: true }>(`${portal(slug)}/${id}/reschedule`, { method: 'POST', portalToken, ...json(body) });

export const listWaitlist = (orgId: string) => api<WaitlistEntryDto[]>('/org/waitlist', { headers: inOrg(orgId) });
export const addWaitlist = (orgId: string, body: CreateWaitlistRequest) =>
  api<WaitlistEntryDto>('/org/waitlist', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const resolveWaitlist = (orgId: string, id: string) => api<void>(`/org/waitlist/${id}`, { method: 'DELETE', headers: inOrg(orgId) });
