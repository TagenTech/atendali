'use client';

import { GUARDIAN_RELATIONSHIPS, GUARDIAN_RELATIONSHIP_LABEL, isValidPhone, type GuardianRelationship } from '@skedulei/contracts';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { cn } from '@/lib/utils';

export interface PatientValues {
  name: string;
  phone: string;
  email: string | null;
  patientName?: string;
  patientBirthDate?: string | null;
  relationship?: GuardianRelationship | null;
}

/** "Seus dados": quem marca, para quem é (si mesmo ou outra pessoa), celular e e-mail. Valida e devolve os valores. */
export function PatientForm({
  clientWord,
  today,
  saving,
  error,
  submitLabel = 'Confirmar agendamento',
  onSubmit,
}: {
  clientWord: string;
  today: string | null;
  saving: boolean;
  error: string | null;
  submitLabel?: string;
  onSubmit: (v: PatientValues) => void;
}) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  // Reserva para outra pessoa (filho, mãe…): o paciente é ele; quem marca fica como responsável.
  const [forOther, setForOther] = React.useState(false);
  const [patientName, setPatientName] = React.useState('');
  const [patientBirth, setPatientBirth] = React.useState('');
  const [relationship, setRelationship] = React.useState<GuardianRelationship | ''>('');
  const [local, setLocal] = React.useState<string | null>(null);
  const patient = clientWord === 'Paciente';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (forOther && patientName.trim().length < 2) return setLocal(`Informe o nome d${patient ? 'o paciente' : 'a pessoa que será atendida'}`);
    if (name.trim().length < 2) return setLocal('Informe seu nome');
    if (!isValidPhone(phone)) return setLocal('Informe um celular válido, com DDD');
    setLocal(null);
    onSubmit({
      name: name.trim(),
      phone,
      email: email.trim() || null,
      ...(forOther ? { patientName: patientName.trim(), patientBirthDate: patientBirth || null, relationship: relationship || null } : {}),
    });
  };

  const shown = local ?? error;
  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4" noValidate>
      <div role="radiogroup" aria-label="Para quem é" className="grid grid-cols-2 gap-2">
        {[
          { other: false, label: 'Para mim' },
          { other: true, label: patient ? 'Para outro paciente (filho, mãe…)' : 'Para outra pessoa' },
        ].map((o) => (
          <button
            key={String(o.other)}
            type="button"
            role="radio"
            aria-checked={forOther === o.other}
            onClick={() => setForOther(o.other)}
            className={cn('rounded-2xl border-2 px-3 py-3 text-sm font-semibold', forOther === o.other ? 'border-primary bg-primary-soft' : 'border-border bg-card')}
          >
            {o.label}
          </button>
        ))}
      </div>
      {forOther ? (
        <>
          <Field label={`Nome d${patient ? 'o paciente' : 'a pessoa atendida'}`} htmlFor="bk-patient">
            <Input id="bk-patient" value={patientName} maxLength={120} onChange={(e) => setPatientName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nascimento (opcional)" htmlFor="bk-birth">
              <Input id="bk-birth" type="date" value={patientBirth} max={today ?? undefined} onChange={(e) => setPatientBirth(e.target.value)} />
            </Field>
            <Field label="Seu parentesco" htmlFor="bk-rel">
              <select id="bk-rel" value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship | '')} className="h-13 w-full rounded-2xl border border-input bg-card px-3">
                <option value="">Prefiro não informar</option>
                {GUARDIAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {GUARDIAN_RELATIONSHIP_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      ) : null}
      <Field label={forOther ? 'Seu nome (quem está marcando)' : 'Seu nome'} htmlFor="bk-name">
        <Input id="bk-name" autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Celular (WhatsApp)" htmlFor="bk-phone" hint="Para confirmar o horário com você">
        <PhoneInput id="bk-phone" value={phone} onChange={setPhone} />
      </Field>
      <Field label="E-mail (recomendado)" htmlFor="bk-email" hint="Enviamos o comprovante e o código para ver, remarcar ou cancelar suas reservas depois">
        <Input id="bk-email" type="email" autoComplete="email" value={email} maxLength={180} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {shown ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
          {shown}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={saving}>
        {submitLabel}
      </Button>
    </form>
  );
}
