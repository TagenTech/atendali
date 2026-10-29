'use client';

import {
  composeRecordContent,
  Feature,
  formatDateShort,
  occupiesSlot,
  parseRecordSections,
  Permission,
  RECORD_KIND_HINT,
  RECORD_KIND_LABEL,
  RECORD_KINDS,
  RECORD_SHEET_TITLE,
  recordDraftErrors,
  recordFields,
  RX_LINES_MAX,
  suggestedRecordTitle,
  type AppointmentDto,
  type ClinicalRecordDto,
  type RecordField,
  type RecordKind,
  type RxLine,
  emptyRxLine,
  zonedParts,
} from '@skedulei/contracts';
import { ClipboardList, FileBadge, Lock, Pill, Plus, Printer, Stethoscope, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, useModalExpanded } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useCreateRecord, useDeleteRecord, useRecords } from '@/lib/queries/clinico';
import { useFieldErrors } from '@/lib/use-field-errors';
import { cn } from '@/lib/utils';

const SELECT =
  'h-13 w-full rounded-2xl border border-input bg-card px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft';

const KIND_ICON: Record<RecordKind, typeof Stethoscope> = {
  EVOLUCAO: Stethoscope,
  PRESCRICAO: Pill,
  ATESTADO: FileBadge,
};

const KIND_RAIL: Record<RecordKind, string> = {
  EVOLUCAO: 'border-l-primary',
  PRESCRICAO: 'border-l-[color:var(--stu-ceu-fg)]',
  ATESTADO: 'border-l-warning',
};

const KIND_BADGE: Record<RecordKind, string> = {
  EVOLUCAO: 'bg-primary-soft text-primary-soft-foreground',
  PRESCRICAO: 'bg-sky-soft text-[color:var(--stu-ceu-fg)]',
  ATESTADO: 'bg-warning-soft text-warning-soft-foreground',
};

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printRecord(p: {
  orgName: string;
  patientName: string;
  kindLabel: string;
  title: string | null;
  authorName: string;
  dateLabel: string;
  content: string;
}) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return false;
  const sections = parseRecordSections(p.content)
    .map((s) => `<section><h2>${escapeHtml(s.label)}</h2><p>${escapeHtml(s.value)}</p></section>`)
    .join('');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(p.kindLabel)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #2f2140; margin: 32px auto; max-width: 640px; }
  header { border-bottom: 1px solid #dce5e4; padding-bottom: 16px; margin-bottom: 24px; }
  .org { font-size: 13px; color: #672d7a; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  .meta { font-size: 13px; color: #566b70; }
  h2 { font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #566b70; margin: 20px 0 4px; }
  p { white-space: pre-wrap; margin: 0; line-height: 1.5; }
  .sign { margin-top: 64px; text-align: center; font-size: 13px; }
  .sign span { display: block; width: 220px; border-top: 1px solid #2f2140; margin: 0 auto 8px; }
  footer { margin-top: 40px; border-top: 1px solid #dce5e4; padding-top: 16px; font-size: 12px; color: #566b70; }
</style></head><body>
<header>
  <div class="org">${escapeHtml(p.orgName)}</div>
  <h1>${escapeHtml(p.title || p.kindLabel)}</h1>
  <div class="meta">${escapeHtml(p.patientName)} · ${escapeHtml(p.dateLabel)} · ${escapeHtml(p.authorName)}</div>
</header>
${sections}
<div class="sign"><span></span>${escapeHtml(p.authorName)}</div>
<footer>Documento gerado no Skedulei. A validade depende da assinatura e do carimbo de quem atende — não substitui receita ou atestado com certificação digital.</footer>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

function TwoCol({ children }: { children: React.ReactNode }) {
  const expanded = useModalExpanded();
  return <div className={cn(expanded && 'grid items-start gap-4 lg:grid-cols-2')}>{children}</div>;
}

function Wide({ children }: { children: React.ReactNode }) {
  const expanded = useModalExpanded();
  return <div className={cn(expanded && 'lg:col-span-2')}>{children}</div>;
}

function SaveBar({ pending }: { pending: boolean }) {
  const expanded = useModalExpanded();
  return (
    <div className={cn(expanded && 'flex justify-end')}>
      <Button type="submit" block={!expanded} className={expanded ? 'min-w-52' : undefined} loading={pending}>
        Salvar anotação
      </Button>
    </div>
  );
}

function RecordFieldControl({
  field,
  value,
  invalid,
  onChange,
}: {
  field: RecordField;
  value: string;
  invalid?: boolean;
  onChange: (v: string) => void;
}) {
  const expanded = useModalExpanded();
  const id = `rec-${field.id}`;
  if (field.type === 'long') {
    return (
      <Textarea
        id={id}
        rows={field.required ? (expanded ? 8 : 5) : expanded ? 5 : 3}
        className={expanded ? (field.required ? 'min-h-40' : 'min-h-32') : field.required ? undefined : 'min-h-24'}
        maxLength={4000}
        placeholder={field.placeholder}
        value={value}
        invalid={invalid}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select id={id} className={SELECT} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined}>
        <option value="">Selecione</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      id={id}
      type={field.type === 'number' ? 'number' : 'text'}
      inputMode={field.type === 'number' ? 'numeric' : undefined}
      min={field.type === 'number' ? 1 : undefined}
      max={field.id === 'dias' ? 365 : undefined}
      placeholder={field.placeholder}
      value={value}
      invalid={invalid}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NewRecordSheet({
  clientId,
  clientName,
  appointments,
  timezone,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  appointments: AppointmentDto[];
  timezone: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { org } = useOrg();
  const segment = org.segment;
  const create = useCreateRecord(clientId);
  const [kind, setKind] = React.useState<RecordKind>('EVOLUCAO');
  const [title, setTitle] = React.useState(suggestedRecordTitle('EVOLUCAO', segment));
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [rx, setRx] = React.useState<RxLine[]>([emptyRxLine(), emptyRxLine()]);
  const [appointmentId, setAppointmentId] = React.useState('');
  const { errors, fail, clear } = useFieldErrors();
  const fields = recordFields(kind, segment);
  const setValue = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    clear(`rec-${id}`);
  };
  const preview =
    kind === 'PRESCRICAO' || kind === 'ATESTADO'
      ? composeRecordContent({ kind, segment, values, rx, patientName: clientName })
      : '';
  const recent = appointments.filter((a) => occupiesSlot(a.status)).slice(0, 12);

  return (
    <Sheet
      open
      placement="center"
      onOpenChange={onOpenChange}
      title={RECORD_SHEET_TITLE[kind]}
      description="Só quem tem acesso clínico vê. Cada abertura e cada anotação ficam registradas."
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const found = recordDraftErrors({ kind, segment, values, rx, patientName: clientName });
          const mapped = Object.fromEntries(
            Object.entries(found).map(([k, msg]) => [k === 'rx' ? 'rec-rx-0-name' : `rec-${k}`, msg]),
          );
          if (!fail(mapped)) return;
          try {
            await create.mutateAsync({
              kind,
              title: title.trim() || null,
              content: composeRecordContent({ kind, segment, values, rx, patientName: clientName }),
              appointmentId: appointmentId || null,
            });
            toast.success('Anotação salva');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
          {RECORD_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <Chip
                key={k}
                active={kind === k}
                className="[&_svg]:size-3.5"
                onClick={() => {
                  setTitle((t) => (t === suggestedRecordTitle(kind, segment) ? suggestedRecordTitle(k, segment) : t));
                  setKind(k);
                  setValues({});
                  setRx([emptyRxLine(), emptyRxLine()]);
                }}
              >
                <Icon aria-hidden /> {RECORD_KIND_LABEL[k]}
              </Chip>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">{RECORD_KIND_HINT[kind]}</p>

        <TwoCol>
          <Field label="Título" htmlFor="rec-title">
            <Input id="rec-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          {recent.length ? (
            <Field label="Horário deste atendimento" htmlFor="rec-appt" hint="Opcional — liga a anotação à consulta.">
              <select id="rec-appt" className={SELECT} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">Sem vínculo</option>
                {recent.map((a) => {
                  const p = zonedParts(new Date(a.startsAt), timezone);
                  return (
                    <option key={a.id} value={a.id}>
                      {formatDateShort(p.date, false)} · {p.time} · {a.serviceName}
                    </option>
                  );
                })}
              </select>
            </Field>
          ) : null}
        </TwoCol>

        {kind === 'PRESCRICAO' ? (
          <fieldset className="space-y-3">
            <legend className="pl-1 text-sm font-semibold">Medicamentos</legend>
            {rx.map((line, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-border p-3">
                <Field label={`Medicamento ${i + 1}`} htmlFor={`rec-rx-${i}-name`} error={i === 0 ? errors['rec-rx-0-name'] : undefined}>
                  <Input
                    id={`rec-rx-${i}-name`}
                    placeholder="Nome e concentração"
                    value={line.name}
                    invalid={i === 0 && !!errors['rec-rx-0-name']}
                    autoComplete="off"
                    onChange={(e) => {
                      setRx((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)));
                      if (i === 0) clear('rec-rx-0-name');
                    }}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Dose" htmlFor={`rec-rx-${i}-dose`}>
                    <Input
                      id={`rec-rx-${i}-dose`}
                      placeholder="1 cp"
                      value={line.dose}
                      autoComplete="off"
                      onChange={(e) => setRx((prev) => prev.map((r, j) => (j === i ? { ...r, dose: e.target.value } : r)))}
                    />
                  </Field>
                  <Field label="Frequência" htmlFor={`rec-rx-${i}-schedule`}>
                    <Input
                      id={`rec-rx-${i}-schedule`}
                      placeholder="6/6 h"
                      value={line.schedule}
                      autoComplete="off"
                      onChange={(e) => setRx((prev) => prev.map((r, j) => (j === i ? { ...r, schedule: e.target.value } : r)))}
                    />
                  </Field>
                  <Field label="Duração" htmlFor={`rec-rx-${i}-duration`}>
                    <Input
                      id={`rec-rx-${i}-duration`}
                      placeholder="7 dias"
                      value={line.duration}
                      autoComplete="off"
                      onChange={(e) => setRx((prev) => prev.map((r, j) => (j === i ? { ...r, duration: e.target.value } : r)))}
                    />
                  </Field>
                </div>
                {rx.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRx((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            ))}
            {rx.length < RX_LINES_MAX ? (
              <Button type="button" size="sm" variant="soft" onClick={() => setRx((prev) => [...prev, emptyRxLine()])}>
                <Plus /> Outro medicamento
              </Button>
            ) : null}
          </fieldset>
        ) : null}

        <TwoCol>
          {fields.flatMap((f, i) => {
            if (f.group === 'vitals') {
              if (fields.slice(0, i).some((p) => p.group === 'vitals')) return [];
              const vitals = fields.filter((x) => x.group === 'vitals');
              return [
                <Wide key="vitals">
                  <fieldset className="space-y-1.5">
                    <legend className="pl-1 text-sm font-semibold">Sinais</legend>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {vitals.map((v) => (
                        <Field key={v.id} label={v.label} htmlFor={`rec-${v.id}`}>
                          <Input
                            id={`rec-${v.id}`}
                            placeholder={v.placeholder}
                            value={values[v.id] ?? ''}
                            autoComplete="off"
                            onChange={(e) => setValue(v.id, e.target.value)}
                          />
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                </Wide>,
              ];
            }
            return [
              <Field key={f.id} label={f.label} htmlFor={`rec-${f.id}`} error={errors[`rec-${f.id}`]} hint={f.hint}>
                <RecordFieldControl
                  field={f}
                  value={values[f.id] ?? ''}
                  invalid={!!errors[`rec-${f.id}`]}
                  onChange={(v) => setValue(f.id, v)}
                />
              </Field>,
            ];
          })}
        </TwoCol>

        {errors['rec-content'] ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors['rec-content']}
          </p>
        ) : null}

        {preview ? (
          <div className="rounded-3xl border border-border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-extrabold">{kind === 'ATESTADO' ? 'Como fica o atestado' : 'Como fica a receita'}</p>
            {parseRecordSections(preview).map((s) => (
              <div key={s.label} className="mt-2">
                <p className="text-xs font-bold text-muted-foreground">{s.label}</p>
                <p className="whitespace-pre-line text-sm">{s.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <SaveBar pending={create.isPending} />
      </form>
    </Sheet>
  );
}

function ViewRecordSheet({
  record,
  clientName,
  orgName,
  timezone,
  appointment,
  onOpenChange,
}: {
  record: ClinicalRecordDto;
  clientName: string;
  orgName: string;
  timezone: string;
  appointment?: AppointmentDto;
  onOpenChange: (v: boolean) => void;
}) {
  const when = zonedParts(new Date(record.createdAt), timezone);
  const dateLabel = `${formatDateShort(when.date)} · ${when.time}`;
  const linkedParts = appointment ? zonedParts(new Date(appointment.startsAt), timezone) : null;
  const sections = parseRecordSections(record.content);
  return (
    <Sheet
      open
      placement="center"
      onOpenChange={onOpenChange}
      title={record.title || RECORD_KIND_LABEL[record.kind]}
      description={`${RECORD_KIND_LABEL[record.kind]} · ${dateLabel} · ${record.authorName}`}
    >
      {appointment && linkedParts ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {appointment.serviceName} · {formatDateShort(linkedParts.date, false)} · {linkedParts.time}
        </p>
      ) : null}
      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.label}>
            {s.label !== 'Notas' ? <p className="text-xs font-bold text-muted-foreground">{s.label}</p> : null}
            <p className="whitespace-pre-line text-base leading-relaxed">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => {
            const ok = printRecord({
              orgName,
              patientName: clientName,
              kindLabel: RECORD_KIND_LABEL[record.kind],
              title: record.title,
              authorName: record.authorName,
              dateLabel,
              content: record.content,
            });
            if (!ok) toast.error('Permita a janela de impressão neste navegador.');
          }}
        >
          <Printer /> Imprimir
        </Button>
      </div>
    </Sheet>
  );
}

/** Prontuário do paciente: evoluções, prescrições e atestados. Só com o módulo ligado e acesso clínico. */
export function ClientRecords({
  clientId,
  clientName,
  appointments = [],
}: {
  clientId: string;
  clientName: string;
  appointments?: AppointmentDto[];
}) {
  const { org, has, can } = useOrg();
  const enabled = has(Feature.PRONTUARIO) && can(Permission.CLINICAL_RECORDS);
  const records = useRecords(clientId, enabled);
  const remove = useDeleteRecord(clientId);
  const [adding, setAdding] = React.useState(false);
  const [viewing, setViewing] = React.useState<ClinicalRecordDto | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<RecordKind | 'TODAS'>('TODAS');
  if (!enabled) return null;
  const list = records.data ?? [];
  const counts = Object.fromEntries(RECORD_KINDS.map((k) => [k, list.filter((r) => r.kind === k).length])) as Record<
    RecordKind,
    number
  >;
  const shown = filter === 'TODAS' ? list : list.filter((r) => r.kind === filter);
  const apptById = new Map(appointments.map((a) => [a.id, a]));

  return (
    <section aria-label="Prontuário">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
        <ClipboardList className="size-5 text-primary" /> Prontuário
        <Button size="sm" variant="soft" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus /> Nova anotação
        </Button>
      </h2>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Dado de saúde: só quem tem acesso clínico vê, e cada abertura fica registrada.
      </p>
      {list.length ? (
        <div role="group" aria-label="Filtrar prontuário" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={filter === 'TODAS'} count={list.length} onClick={() => setFilter('TODAS')}>
            Todas
          </Chip>
          {RECORD_KINDS.map((k) => (
            <Chip key={k} active={filter === k} count={counts[k]} onClick={() => setFilter(k)}>
              {RECORD_KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      ) : null}
      {records.isLoading ? (
        <Card className="text-muted-foreground">Carregando…</Card>
      ) : shown.length ? (
        <ol className="space-y-2">
          {shown.map((r) => {
            const Icon = KIND_ICON[r.kind];
            const when = zonedParts(new Date(r.createdAt), org.timezone);
            const linked = r.appointmentId ? apptById.get(r.appointmentId) : undefined;
            const linkedParts = linked ? zonedParts(new Date(linked.startsAt), org.timezone) : null;
            const sections = parseRecordSections(r.content);
            return (
              <li key={r.id}>
                <article
                  className={cn('cursor-pointer rounded-3xl border border-border border-l-4 bg-card p-4 hover:bg-muted/40', KIND_RAIL[r.kind])}
                  onClick={() => setViewing(r)}
                >
                  <header className="flex flex-wrap items-start gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', KIND_BADGE[r.kind])}>
                      <Icon className="size-3.5" aria-hidden /> {RECORD_KIND_LABEL[r.kind]}
                    </span>
                    {r.title ? <strong className="text-sm text-foreground">{r.title}</strong> : null}
                    <span className="text-sm text-muted-foreground">
                      {formatDateShort(when.date)} · {when.time} · {r.authorName}
                    </span>
                    <span className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Imprimir ${RECORD_KIND_LABEL[r.kind].toLowerCase()}`}
                        onClick={() => {
                          const ok = printRecord({
                            orgName: org.name,
                            patientName: clientName,
                            kindLabel: RECORD_KIND_LABEL[r.kind],
                            title: r.title,
                            authorName: r.authorName,
                            dateLabel: `${formatDateShort(when.date)} · ${when.time}`,
                            content: r.content,
                          });
                          if (!ok) toast.error('Permita a janela de impressão neste navegador.');
                        }}
                      >
                        <Printer />
                      </Button>
                      {r.canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
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
                    </span>
                  </header>
                  {linked && linkedParts ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linked.serviceName} · {formatDateShort(linkedParts.date, false)} · {linkedParts.time}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-2.5 text-foreground">
                    {sections.map((s) => (
                      <div key={s.label}>
                        {s.label !== 'Notas' ? <p className="text-xs font-bold text-muted-foreground">{s.label}</p> : null}
                        <p className="whitespace-pre-line text-sm">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      ) : list.length ? (
        <p className="rounded-3xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {filter === 'ATESTADO' ? 'Nenhum atestado neste prontuário.' : `Nenhuma ${RECORD_KIND_LABEL[filter as RecordKind].toLowerCase()} neste prontuário.`}
        </p>
      ) : (
        <p className="rounded-3xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Ainda não há evolução, prescrição ou atestado.
        </p>
      )}
      {adding ? (
        <NewRecordSheet
          clientId={clientId}
          clientName={clientName}
          appointments={appointments}
          timezone={org.timezone}
          onOpenChange={setAdding}
        />
      ) : null}
      {viewing ? (
        <ViewRecordSheet
          record={viewing}
          clientName={clientName}
          orgName={org.name}
          timezone={org.timezone}
          appointment={viewing.appointmentId ? apptById.get(viewing.appointmentId) : undefined}
          onOpenChange={(v) => !v && setViewing(null)}
        />
      ) : null}
    </section>
  );
}
