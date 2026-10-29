'use client';

import {
  DOCUMENT_KIND_LABEL,
  Feature,
  QUESTION_TYPE_LABEL,
  QUESTIONS_MAX,
  TERM_BODY_MAX,
  validateTemplate,
  type DocQuestion,
  type DocumentKind,
  type DocumentTemplateDto,
  type QuestionType,
} from '@skedulei/contracts';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Ledger } from '@/components/ui/ledger';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useSaveTemplate, useTemplates } from '@/lib/queries/clinico';

const newId = () => `q${Math.random().toString(36).slice(2, 9)}`;

function TemplateSheet({ kind, template, onOpenChange }: { kind: DocumentKind; template: DocumentTemplateDto | null; onOpenChange: (v: boolean) => void }) {
  const save = useSaveTemplate(kind);
  const [title, setTitle] = React.useState(template?.title ?? '');
  const [active, setActive] = React.useState(template?.active ?? true);
  const [body, setBody] = React.useState(template?.body ?? '');
  const [questions, setQuestions] = React.useState<DocQuestion[]>(template?.questions ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const patch = (i: number, p: Partial<DocQuestion>) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { kind, title: title.trim(), active, ...(kind === 'TERMO' ? { body: body.trim() } : { questions: questions.map((q) => ({ ...q, label: q.label.trim() })) }) };
    const problem = validateTemplate(input);
    if (problem) return setError(problem);
    setError(null);
    try {
      await save.mutateAsync({ id: template?.id, body: input });
      toast.success('Modelo salvo');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={template ? `Editar ${DOCUMENT_KIND_LABEL[kind].toLowerCase()}` : `Novo modelo de ${DOCUMENT_KIND_LABEL[kind].toLowerCase()}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome do modelo" htmlFor="tpl-title">
          <Input id="tpl-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {kind === 'TERMO' ? (
          <Field label="Texto do termo" htmlFor="tpl-body" hint={`Até ${TERM_BODY_MAX} letras. O paciente lê e digita o nome para aceitar.`}>
            <Textarea id="tpl-body" rows={10} maxLength={TERM_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Perguntas</p>
            {questions.map((q, i) => (
              <Card key={q.id} className="space-y-2 p-3">
                <Field label={`Pergunta ${i + 1}`} htmlFor={`tpl-q-${q.id}`}>
                  <Input id={`tpl-q-${q.id}`} value={q.label} maxLength={200} onChange={(e) => patch(i, { label: e.target.value })} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Tipo de resposta" htmlFor={`tpl-t-${q.id}`}>
                    <select id={`tpl-t-${q.id}`} value={q.type} onChange={(e) => patch(i, { type: e.target.value as QuestionType })} className="h-13 w-full rounded-2xl border border-input bg-card px-3">
                      {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                        <option key={t} value={t}>
                          {QUESTION_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {q.type === 'ESCOLHA' ? (
                    <Field label="Opções" htmlFor={`tpl-o-${q.id}`} hint="Separadas por vírgula">
                      <Input id={`tpl-o-${q.id}`} value={(q.options ?? []).join(', ')} onChange={(e) => patch(i, { options: e.target.value.split(',').map((o) => o.trim()) })} />
                    </Field>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-auto flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!q.required} onChange={(e) => patch(i, { required: e.target.checked })} /> Obrigatória
                  </label>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Subir pergunta ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Descer pergunta ${i + 1}`} disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remover pergunta ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            ))}
            <Button type="button" variant="outline" disabled={questions.length >= QUESTIONS_MAX} onClick={() => setQuestions((qs) => [...qs, { id: newId(), label: '', type: 'TEXTO' }])}>
              <Plus /> Adicionar pergunta
            </Button>
          </div>
        )}
        <SwitchRow id="tpl-active" checked={active} onCheckedChange={setActive} title="Disponível para enviar" description="Desligado, o modelo some da lista de envio (o que já foi enviado continua valendo)." />
        {error ? (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
            {error}
          </p>
        ) : null}
        <Button type="submit" block loading={save.isPending}>
          Salvar modelo
        </Button>
      </form>
    </Sheet>
  );
}

function Group({ kind }: { kind: DocumentKind }) {
  const list = useTemplates(kind);
  const [editing, setEditing] = React.useState<{ template: DocumentTemplateDto | null } | null>(null);
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-semibold">
        {DOCUMENT_KIND_LABEL[kind]}
        <Button size="sm" variant="soft" className="ml-auto" onClick={() => setEditing({ template: null })}>
          <Plus /> Novo modelo
        </Button>
      </p>
      {list.data?.length ? (
        <Ledger className="divide-y divide-border">
          {list.data.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.title}</span>
                <span className="block text-xs text-muted-foreground">{kind === 'ANAMNESE' ? `${t.questions.length} perguntas` : 'Termo'}{t.active ? '' : ' · desligado'}</span>
              </span>
              <Button size="sm" variant="ghost" aria-label={`Editar ${t.title}`} onClick={() => setEditing({ template: t })}>
                <Pencil />
              </Button>
            </div>
          ))}
        </Ledger>
      ) : null}
      {editing ? <TemplateSheet key={editing.template?.id ?? 'new'} kind={kind} template={editing.template} onOpenChange={(v) => !v && setEditing(null)} /> : null}
    </div>
  );
}

/** Configurações → modelos de ficha de anamnese e de termo (só os módulos ligados). */
export function TemplatesEditor() {
  const { has } = useOrg();
  return (
    <div className="space-y-6">
      {has(Feature.ANAMNESE) ? <Group kind="ANAMNESE" /> : null}
      {has(Feature.TERMOS) ? <Group kind="TERMO" /> : null}
    </div>
  );
}
