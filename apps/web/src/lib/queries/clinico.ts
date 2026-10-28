'use client';

import type { ClinicalRecordInput, DocumentKind, DocumentTemplateInput, SubmitDocumentRequest } from '@skedulei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as c from '@/lib/api/clinico';
import { useOrg } from '@/lib/org';

export const clinKeys = {
  records: (orgId: string, clientId: string) => ['org', orgId, 'clinico', 'records', clientId] as const,
  documents: (orgId: string, clientId: string) => ['org', orgId, 'clinico', 'documents', clientId] as const,
  document: (orgId: string, id: string) => ['org', orgId, 'clinico', 'document', id] as const,
  templates: (orgId: string, kind: DocumentKind) => ['org', orgId, 'clinico', 'templates', kind] as const,
};

export function useRecords(clientId: string, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: clinKeys.records(org.id, clientId), queryFn: () => c.listRecords(org.id, clientId), enabled, retry: false });
}

export function useCreateRecord(clientId: string) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClinicalRecordInput) => c.createRecord(org.id, clientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinKeys.records(org.id, clientId) }),
  });
}

export function useDeleteRecord(clientId: string) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => c.deleteRecord(org.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinKeys.records(org.id, clientId) }),
  });
}

export function useTemplates(kind: DocumentKind, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: clinKeys.templates(org.id, kind), queryFn: () => c.listTemplates(org.id, kind), enabled, retry: false });
}

export function useSaveTemplate(kind: DocumentKind) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: DocumentTemplateInput }) => (id ? c.updateTemplate(org.id, id, body) : c.createTemplate(org.id, body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinKeys.templates(org.id, kind) }),
  });
}

export function useDocuments(clientId: string, enabled = true) {
  const { org } = useOrg();
  return useQuery({ queryKey: clinKeys.documents(org.id, clientId), queryFn: () => c.listDocuments(org.id, clientId), enabled, retry: false });
}

export function useDocument(id: string | null) {
  const { org } = useOrg();
  return useQuery({ queryKey: clinKeys.document(org.id, id ?? ''), queryFn: () => c.getDocument(org.id, id!), enabled: !!id, retry: false });
}

export function useSendDocument(clientId: string) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => c.sendDocument(org.id, clientId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinKeys.documents(org.id, clientId) }),
  });
}

export function useCompleteDocument(clientId: string) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmitDocumentRequest }) => c.completeDocument(org.id, id, body),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: clinKeys.documents(org.id, clientId) });
      void qc.invalidateQueries({ queryKey: clinKeys.document(org.id, v.id) });
    },
  });
}

export function useRemoveDocument(clientId: string) {
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => c.removeDocument(org.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinKeys.documents(org.id, clientId) }),
  });
}
