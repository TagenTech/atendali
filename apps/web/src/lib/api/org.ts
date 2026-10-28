import type {
  AcceptInviteRequest,
  CreateMemberRequest,
  CreateOrganizationRequest,
  InviteInfoDto,
  MemberDto,
  OrganizationDto,
  OrganizationSummaryDto,
  ServiceDto,
  ServiceInput,
  UnitDto,
  UnitInput,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UpdateServiceRequest,
  UpdateUnitRequest,
} from '@agendei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const myOrganizations = () => api<OrganizationSummaryDto[]>('/organizations');
export const createOrganization = (body: CreateOrganizationRequest) =>
  api<OrganizationDto>('/organizations', { method: 'POST', ...json(body) });

/** Rotas do negócio ativo: o id explícito evita corrida ao trocar de negócio. */
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });

export const getOrganization = (orgId: string) => api<OrganizationDto>('/org', { headers: inOrg(orgId) });
export const updateOrganization = (orgId: string, body: UpdateOrganizationRequest) =>
  api<OrganizationDto>('/org', { method: 'PATCH', headers: inOrg(orgId), ...json(body) });

export const listUnits = (orgId: string) => api<UnitDto[]>('/org/units', { headers: inOrg(orgId) });
export const createUnit = (orgId: string, body: UnitInput) =>
  api<UnitDto>('/org/units', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateUnit = (orgId: string, id: string, body: UpdateUnitRequest) =>
  api<UnitDto>(`/org/units/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });

export const listMembers = (orgId: string) => api<MemberDto[]>('/org/members', { headers: inOrg(orgId) });
export const createMember = (orgId: string, body: CreateMemberRequest) =>
  api<MemberDto>('/org/members', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateMember = (orgId: string, id: string, body: UpdateMemberRequest) =>
  api<MemberDto>(`/org/members/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });
export const removeMember = (orgId: string, id: string) =>
  api<void>(`/org/members/${id}`, { method: 'DELETE', headers: inOrg(orgId) });
export const resendInvite = (orgId: string, id: string) =>
  api<MemberDto>(`/org/members/${id}/resend-invite`, { method: 'POST', headers: inOrg(orgId) });

export const listServices = (orgId: string) => api<ServiceDto[]>('/org/services', { headers: inOrg(orgId) });
export const createService = (orgId: string, body: ServiceInput) =>
  api<ServiceDto>('/org/services', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateService = (orgId: string, id: string, body: UpdateServiceRequest) =>
  api<ServiceDto>(`/org/services/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });

export const inviteInfo = (token: string) => api<InviteInfoDto>(`/invites/info?token=${encodeURIComponent(token)}`);
export const acceptInvite = (body: AcceptInviteRequest) =>
  api<OrganizationSummaryDto>('/invites/accept', { method: 'POST', ...json(body) });

export const setBrandImage = (orgId: string, kind: 'logo' | 'cover', dataUrl: string) =>
  api<OrganizationDto>(`/org/branding/${kind}`, { method: 'PUT', headers: inOrg(orgId), ...json({ dataUrl }) });
export const removeBrandImage = (orgId: string, kind: 'logo' | 'cover') =>
  api<OrganizationDto>(`/org/branding/${kind}`, { method: 'DELETE', headers: inOrg(orgId) });
