import type {
  ClinicalRecordDto,
  ClinicalRecordInput,
  DocumentKind,
  DocumentTemplateDto,
  DocumentTemplateInput,
  PatientDocumentDetailDto,
  PatientDocumentDto,
  PublicDocumentDto,
  SubmitDocumentRequest,
} from '@skedulei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const inOrg = (orgId: string) => ({ 'x-organization-id': orgId });
const base = (clientId: string) => `/org/clients/${clientId}`;

// prontuário
export const listRecords = (orgId: string, clientId: string) => api<ClinicalRecordDto[]>(`${base(clientId)}/records`, { headers: inOrg(orgId) });
export const createRecord = (orgId: string, clientId: string, body: ClinicalRecordInput) =>
  api<ClinicalRecordDto>(`${base(clientId)}/records`, { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const deleteRecord = (orgId: string, id: string) => api<void>(`/org/records/${id}`, { method: 'DELETE', headers: inOrg(orgId) });

// modelos
export const listTemplates = (orgId: string, kind: DocumentKind) => api<DocumentTemplateDto[]>(`/org/documents/templates?tipo=${kind}`, { headers: inOrg(orgId) });
export const createTemplate = (orgId: string, body: DocumentTemplateInput) =>
  api<DocumentTemplateDto>('/org/documents/templates', { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const updateTemplate = (orgId: string, id: string, body: DocumentTemplateInput) =>
  api<DocumentTemplateDto>(`/org/documents/templates/${id}`, { method: 'PATCH', headers: inOrg(orgId), ...json(body) });

// documentos do paciente
export const listDocuments = (orgId: string, clientId: string) => api<PatientDocumentDto[]>(`${base(clientId)}/documents`, { headers: inOrg(orgId) });
export const sendDocument = (orgId: string, clientId: string, templateId: string) =>
  api<PatientDocumentDto>(`${base(clientId)}/documents`, { method: 'POST', headers: inOrg(orgId), ...json({ templateId }) });
export const getDocument = (orgId: string, id: string) => api<PatientDocumentDetailDto>(`/org/documents/${id}`, { headers: inOrg(orgId) });
export const completeDocument = (orgId: string, id: string, body: SubmitDocumentRequest) =>
  api<PatientDocumentDto>(`/org/documents/${id}/complete`, { method: 'POST', headers: inOrg(orgId), ...json(body) });
export const removeDocument = (orgId: string, id: string) => api<void>(`/org/documents/${id}`, { method: 'DELETE', headers: inOrg(orgId) });

// link público (paciente)
export const publicDocument = (token: string) => api<PublicDocumentDto>(`/public/documents/${encodeURIComponent(token)}`);
export const submitPublicDocument = (token: string, body: SubmitDocumentRequest) =>
  api<{ ok: true }>(`/public/documents/${encodeURIComponent(token)}`, { method: 'POST', ...json(body) });
