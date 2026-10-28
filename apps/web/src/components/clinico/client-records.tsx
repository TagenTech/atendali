'use client';

import { Feature, formatDateShort, Permission, RECORD_CONTENT_MAX, RECORD_KIND_LABEL, RECORD_KINDS, type RecordKind } from '@skedulei/contracts';
import { ClipboardList, Lock, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCreateRecord, useDeleteRecord, useRecords } from '@/lib/queries/clinico';
import { useFieldErrors } from '@/lib/use-field-errors';

function NewRecordSheet({ clientId, onOpenChange }: { clientId: string; onOpenChange: (v: boolean) => void }) {
  const create = useCreateRecord(clientId);
  const [kind, setKind] = React.useState<RecordKind>('EVOLUCAO');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();
  return (
    <Sheet open onOpenChange={onOpenChange} title="Nova anotação" description="Só quem tem acesso clínico vê. Cada abertura e cada anotação ficam registradas.">
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'rec-content': !content.trim() && 'Escreva a anotação' })) return;
          try {
            await create.mutateAsync({ kind, title: title.trim() || null, content: content.trim() });
            toast.success('Anotação salva');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
          {RECORD_KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {RECORD_KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        <Field label="Título (opcional)" htmlFor="rec-title">
          <Input id="rec-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={RECORD_KIND_LABEL[kind]} htmlFor="rec-content" error={errors['rec-content']} hint="Guardado com criptografia.">
          <Textarea id="rec-content" rows={8} maxLength={RECORD_CONTENT_MAX} value={content} invalid={!!errors['rec-content']} onChange={(e) => (setContent(e.target.value), clear('rec-content'))} autoFocus />
        </Field>
        <Button type="submit" block loading={create.isPending}>
          Salvar anotação
        </Button>
      </form>
    </Sheet>
  );
}

/** Prontuário do paciente: evoluções, prescrições e atestados. Só com o módulo ligado e acesso clínico. */
export function ClientRecords({ clientId }: { clientId: string }) {
  const { has, can } = useOrg();
  const enabled = has(Feature.PRONTUARIO) && can(Permission.CLINICAL_RECORDS);
  const records = useRecords(clientId, enabled);
  const remove = useDeleteRecord(clientId);
  const [adding, setAdding] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  if (!enabled) return null;
  return (
    <section aria-label="Prontuário">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
        <ClipboardList className="size-5 text-primary" /> Prontuário
        <Button size="sm" variant="soft" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus /> Nova anotação
        </Button>
      </h2>
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Dado de saúde: só quem tem acesso clínico vê, e cada abertura fica registrada.
      </p>
      {records.isLoading ? (
        <Card className="text-muted-foreground">Carregando…</Card>
      ) : records.data?.length ? (
        <ul className="space-y-2">
          {records.data.map((r) => (
            <li key={r.id}>
              <Card className="space-y-1.5">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-soft-foreground">{RECORD_KIND_LABEL[r.kind]}</span>
                  {r.title ? <strong>{r.title}</strong> : null}
                  <span className="text-muted-foreground">
                    {formatDateShort(r.createdAt.slice(0, 10))} · {r.authorName}
                  </span>
                  {r.canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      aria-label={confirming === r.id ? 'Confirmar exclusão da anotação' : 'Apagar anotação'}
                      loading={remove.isPending && confirming === r.id}
                      onClick={async () => {
                        if (confirming !== r.id) return setConfirming(r.id);
                        try {
                          await remove.mutateAsync(r.id);
                          toast.success('Anotação apagada');
                        } catch (err) {
                          toast.error(errorText(err));
                        } finally {
                          setConfirming(null);
                        }
                      }}
                    >
                      <Trash2 /> {confirming === r.id ? 'Confirmar' : null}
                    </Button>
                  ) : null}
                </p>
                <p className="whitespace-pre-line text-sm">{r.content}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-sm text-muted-foreground">Nenhuma anotação ainda.</Card>
      )}
      {adding ? <NewRecordSheet clientId={clientId} onOpenChange={setAdding} /> : null}
    </section>
  );
}
