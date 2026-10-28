'use client';

import { validateAnswers, type DocQuestion, type DocumentKind } from '@skedulei/contracts';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Preenchimento de uma ficha de anamnese ou aceite de um termo — igual para a equipe (balcão) e para o paciente (link). */
export function DocumentForm({
  kind,
  questions,
  body,
  saving,
  error,
  submitLabel,
  defaultSignedName,
  onSubmit,
}: {
  kind: DocumentKind;
  questions: DocQuestion[];
  body: string | null;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  defaultSignedName?: string;
  onSubmit: (v: { answers?: Record<string, string>; signedName?: string; accepted?: boolean }) => void;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState(defaultSignedName ?? '');
  const [accepted, setAccepted] = React.useState(false);
  const [local, setLocal] = React.useState<string | null>(null);
  const set = (id: string, v: string) => (setAnswers((a) => ({ ...a, [id]: v })), setLocal(null));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'ANAMNESE') {
      const problem = validateAnswers(questions, answers);
      if (problem) return setLocal(problem);
      return onSubmit({ answers });
    }
    if (!accepted) return setLocal('Marque que você leu e concorda');
    if (name.trim().length < 3) return setLocal('Digite o nome completo de quem está aceitando');
    onSubmit({ signedName: name.trim(), accepted: true });
  };

  const shown = local ?? error;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {kind === 'ANAMNESE' ? (
        questions.map((q) => (
          <Field key={q.id} label={`${q.label}${q.required ? ' *' : ''}`} htmlFor={`q-${q.id}`}>
            {q.type === 'SIM_NAO' ? (
              <div role="radiogroup" id={`q-${q.id}`} aria-label={q.label} className="flex gap-2">
                {[
                  ['SIM', 'Sim'],
                  ['NAO', 'Não'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={answers[q.id] === v}
                    onClick={() => set(q.id, answers[q.id] === v ? '' : v)}
                    className={cn('h-11 flex-1 rounded-2xl border-2 font-semibold', answers[q.id] === v ? 'border-primary bg-primary-soft' : 'border-border bg-card')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            ) : q.type === 'ESCOLHA' ? (
              <select id={`q-${q.id}`} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3">
                <option value="">Escolha…</option>
                {(q.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Textarea id={`q-${q.id}`} rows={2} maxLength={1000} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} />
            )}
          </Field>
        ))
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-2xl bg-muted p-4 text-sm leading-relaxed" tabIndex={0} aria-label="Texto do termo">
            {body}
          </div>
          <label className="flex items-start gap-3 text-sm font-medium">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={accepted} onChange={(e) => (setAccepted(e.target.checked), setLocal(null))} />
            <span>Li o termo e concordo.</span>
          </label>
          <Field label="Nome completo de quem está aceitando" htmlFor="term-name" hint="Vale como assinatura. Fica guardado com a data e o horário.">
            <Input id="term-name" value={name} maxLength={120} autoComplete="name" onChange={(e) => (setName(e.target.value), setLocal(null))} />
          </Field>
        </>
      )}
      {shown ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
          {shown}
        </p>
      ) : null}
      <Button type="submit" size="lg" block loading={saving}>
        {submitLabel}
      </Button>
    </form>
  );
}
