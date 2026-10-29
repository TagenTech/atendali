'use client';

import {
  documentMessage,
  DOCUMENT_KIND_LABEL,
  Feature,
  formatDateShort,
  Permission,
  type DocumentKind,
  type PatientDocumentDto,
  whatsappLink,
} from '@skedulei/contracts';
import { Check, ClipboardList, Copy, FileSignature, MessageCircle, Send, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { DocumentForm } from '@/components/clinico/document-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Ledger } from '@/components/ui/ledger';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCompleteDocument, useDocument, useDocuments, useRemoveDocument, useSendDocument, useTemplates } from '@/lib/queries/clinico';

function SendSheet({ clientId, clientName, phone, onOpenChange, onFill }: { clientId: string; clientName: string; phone: string | null; onOpenChange: (v: boolean) => void; onFill: (id: string) => void }) {
  const { org, has, can } = useOrg();
  const anamnese = useTemplates('ANAMNESE', has(Feature.ANAMNESE));
  const termo = useTemplates('TERMO', has(Feature.TERMOS));
  const options = [...(anamnese.data ?? []), ...(termo.data ?? [])].filter((t) => t.active);
  const send = useSendDocument(clientId);
  const [templateId, setTemplateId] = React.useState('');
  const [sent, setSent] = React.useState<PatientDocumentDto | null>(null);
  const chosen = options.find((t) => t.id === (templateId || options[0]?.id));
  return (
    <Sheet open onOpenChange={onOpenChange} title="Enviar documento" description="O paciente (ou o responsável) preenche pelo celular, sem criar conta. O link vale por 7 dias.">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="rounded-2xl bg-success-soft px-4 py-3 text-sm font-medium text-success-soft-foreground">
            Link criado. Ele só aparece aqui — copie ou envie agora.
          </p>
          <Field label="Link para o paciente" htmlFor="doc-link">
            <Input id="doc-link" readOnly value={sent.link ?? ''} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="soft"
              onClick={async () => {
                await navigator.clipboard.writeText(sent.link ?? '').catch(() => undefined);
                toast.success('Link copiado');
              }}
            >
              <Copy /> Copiar link
            </Button>
            {phone ? (
              <Button asChild variant="outline">
                <a href={whatsappLink(phone, documentMessage({ patientFirstName: clientName.split(' ')[0], orgName: org.name, title: sent.title, link: sent.link ?? '' }))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Enviar no WhatsApp
                </a>
              </Button>
            ) : null}
            {can(Permission.CLINICAL_RECORDS) ? (
              <Button variant="ghost" onClick={() => (onOpenChange(false), onFill(sent.id))}>
                <FileSignature /> Preencher agora no balcão
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!chosen) return;
            try {
              setSent(await send.mutateAsync(chosen.id));
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          {options.length ? (
            <Field label="Documento" htmlFor="doc-template">
              <select id="doc-template" value={templateId || options[0].id} onChange={(e) => setTemplateId(e.target.value)} className="h-13 w-full rounded-2xl border border-input bg-card px-3">
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {DOCUMENT_KIND_LABEL[t.kind]} · {t.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando modelos…</p>
          )}
          <Button type="submit" block loading={send.isPending} disabled={!chosen}>
            Gerar link
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function FillSheet({ clientId, id, onOpenChange }: { clientId: string; id: string; onOpenChange: (v: boolean) => void }) {
  const doc = useDocument(id);
  const complete = useCompleteDocument(clientId);
  const d = doc.data;
  return (
    <Sheet open placement="center" onOpenChange={onOpenChange} title={d ? d.title : 'Documento'} description={d?.status === 'PREENCHIDO' ? 'Documento preenchido' : 'Preencher com o paciente, no balcão'}>
      {!d ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : d.status === 'PREENCHIDO' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preenchido em {formatDateShort(d.completedAt!.slice(0, 10))} {d.completedVia === 'LINK' ? 'pelo link do paciente' : 'pela equipe'}.
          </p>
          {d.kind === 'ANAMNESE' ? (
            <dl className="space-y-3">
              {d.questions.map((q) => (
                <div key={q.id}>
                  <dt className="text-sm font-semibold">{q.label}</dt>
                  <dd className="text-sm text-muted-foreground">{d.answers?.[q.id] ? (d.answers[q.id] === 'SIM' ? 'Sim' : d.answers[q.id] === 'NAO' ? 'Não' : d.answers[q.id]) : '—'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <div className="whitespace-pre-line rounded-2xl bg-muted p-4 text-sm">{d.body}</div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-success" /> Aceito por {d.signedName}
              </p>
            </>
          )}
        </div>
      ) : (
        <DocumentForm
          kind={d.kind}
          questions={d.questions}
          body={d.body}
          saving={complete.isPending}
          error={null}
          submitLabel="Salvar"
          onSubmit={async (v) => {
            try {
              await complete.mutateAsync({ id, body: v });
              toast.success('Documento salvo');
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        />
      )}
    </Sheet>
  );
}

const KIND_ICON: Record<DocumentKind, typeof ClipboardList> = { ANAMNESE: ClipboardList, TERMO: FileSignature };

/** Fichas de anamnese e termos do paciente: enviar o link, preencher no balcão e consultar. */
export function ClientDocuments({ clientId, clientName, phone }: { clientId: string; clientName: string; phone: string | null }) {
  const { has, can } = useOrg();
  const enabled = has(Feature.ANAMNESE) || has(Feature.TERMOS);
  const canSend = can(Permission.CLIENTS_MANAGE) || can(Permission.CLINICAL_RECORDS);
  const docs = useDocuments(clientId, enabled);
  const remove = useRemoveDocument(clientId);
  const [sending, setSending] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  if (!enabled) return null;
  return (
    <section aria-label="Documentos do paciente">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
        <FileSignature className="size-5 text-primary" /> Documentos
        {canSend ? (
          <Button size="sm" variant="soft" className="ml-auto" onClick={() => setSending(true)}>
            <Send /> Enviar
          </Button>
        ) : null}
      </h2>
      {docs.data?.length ? (
        <Ledger className="divide-y divide-border">
          {docs.data.map((d) => {
            const Icon = KIND_ICON[d.kind];
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.status === 'PREENCHIDO' ? `Preenchido em ${formatDateShort(d.completedAt!.slice(0, 10))}` : `Enviado em ${formatDateShort(d.sentAt.slice(0, 10))}`}
                  </span>
                </span>
                <span className={d.status === 'PREENCHIDO' ? 'rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success-soft-foreground' : 'rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-soft-foreground'}>
                  {d.status === 'PREENCHIDO' ? 'Preenchido' : 'Pendente'}
                </span>
                {can(Permission.CLINICAL_RECORDS) ? (
                  <Button size="sm" variant="ghost" onClick={() => setOpen(d.id)} aria-label={`${d.status === 'PREENCHIDO' ? 'Ver' : 'Preencher agora'}: ${d.title}`}>
                    {d.status === 'PREENCHIDO' ? 'Ver' : 'Preencher agora'}
                  </Button>
                ) : null}
                {d.status === 'PENDENTE' && canSend ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Cancelar envio: ${d.title}`}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(d.id);
                        toast.success('Envio cancelado');
                      } catch (err) {
                        toast.error(errorText(err));
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </Ledger>
      ) : (
        <Ledger className="px-4 py-4 text-sm text-muted-foreground">Nenhum documento enviado ainda.</Ledger>
      )}
      {sending ? <SendSheet clientId={clientId} clientName={clientName} phone={phone} onOpenChange={setSending} onFill={setOpen} /> : null}
      {open ? <FillSheet clientId={clientId} id={open} onOpenChange={(v) => !v && setOpen(null)} /> : null}
    </section>
  );
}
