'use client';

import type { MembershipPlanDto, PackagePlanDto } from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useServices } from '@/lib/queries/org';
import { useSaveMembershipPlan, useSavePackagePlan } from '@/lib/queries/retention';

const intOrNull = (v: string) => (v.trim() === '' ? null : Math.trunc(Number(v)));

function ServiceSelect({ id, value, onChange, optional, disabled }: { id: string; value: string; onChange: (v: string) => void; optional?: boolean; disabled?: boolean }) {
  const { data } = useServices();
  const { vocab } = useOrg();
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-13 w-full rounded-2xl border-2 border-input bg-card px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:opacity-60"
    >
      <option value="">{optional ? `Qualquer ${vocab.service.toLowerCase()}` : 'Escolha…'}</option>
      {(data ?? []).filter((s) => s.active).map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/** Criar (plan = null) ou editar um pacote de sessões. O serviço não muda depois de criado. */
export function PackagePlanSheet({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan: PackagePlanDto | null }) {
  const { vocab } = useOrg();
  const save = useSavePackagePlan();
  const [name, setName] = React.useState(plan?.name ?? '');
  const [serviceId, setServiceId] = React.useState(plan?.serviceId ?? '');
  const [sessions, setSessions] = React.useState(String(plan?.sessions ?? 5));
  const [price, setPrice] = React.useState<number | null>(plan?.priceCents ?? null);
  const [validity, setValidity] = React.useState(plan?.validityDays ? String(plan.validityDays) : '');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Dê um nome ao pacote';
    if (!plan && !serviceId) next.service = `Escolha o ${vocab.service.toLowerCase()}`;
    const n = Math.trunc(Number(sessions));
    if (!(n >= 2)) next.sessions = 'Um pacote tem pelo menos 2 sessões';
    if (Object.keys(next).length) return setErrors(next);
    const common = { name: name.trim(), sessions: n, priceCents: price ?? 0, validityDays: intOrNull(validity) };
    try {
      await save.mutateAsync({ id: plan?.id, body: plan ? common : { ...common, serviceId } });
      toast.success(plan ? 'Alterações salvas' : 'Pacote criado ✨');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggle = async () => {
    if (!plan) return;
    try {
      await save.mutateAsync({ id: plan.id, body: { active: !plan.active } });
      toast.success(plan.active ? 'Pacote desativado' : 'Pacote reativado');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={plan ? 'Editar pacote' : 'Novo pacote'} description="O que a pessoa já comprou não muda se você alterar o preço depois.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="pkg-name" error={errors.name}>
          <Input id="pkg-name" value={name} invalid={!!errors.name} maxLength={120} autoFocus={!plan} placeholder="Ex.: 5 sessões" onChange={(e) => (setName(e.target.value), setErrors({}))} />
        </Field>
        <Field label={vocab.service} htmlFor="pkg-service" error={errors.service}>
          <ServiceSelect id="pkg-service" value={serviceId} onChange={(v) => (setServiceId(v), setErrors({}))} disabled={!!plan} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sessões" htmlFor="pkg-sessions" error={errors.sessions}>
            <Input id="pkg-sessions" type="number" inputMode="numeric" min={2} max={200} value={sessions} invalid={!!errors.sessions} onChange={(e) => (setSessions(e.target.value), setErrors({}))} />
          </Field>
          <Field label="Validade (dias)" htmlFor="pkg-validity" hint="Vazio = sem validade">
            <Input id="pkg-validity" type="number" inputMode="numeric" min={1} value={validity} onChange={(e) => setValidity(e.target.value)} />
          </Field>
        </div>
        <Field label="Preço do pacote" htmlFor="pkg-price">
          <MoneyInput id="pkg-price" value={price} onChange={setPrice} />
        </Field>
        <div className="flex gap-3 pt-2">
          {plan ? (
            <Button type="button" variant={plan.active ? 'danger' : 'soft'} onClick={toggle} disabled={save.isPending}>
              {plan.active ? 'Desativar' : 'Reativar'}
            </Button>
          ) : null}
          <Button type="submit" block loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Criar (plan = null) ou editar um plano do clube. */
export function MembershipPlanSheet({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan: MembershipPlanDto | null }) {
  const { vocab } = useOrg();
  const save = useSaveMembershipPlan();
  const [name, setName] = React.useState(plan?.name ?? '');
  const [serviceId, setServiceId] = React.useState(plan?.serviceId ?? '');
  const [perMonth, setPerMonth] = React.useState(plan?.sessionsPerMonth ? String(plan.sessionsPerMonth) : '');
  const [price, setPrice] = React.useState<number | null>(plan?.priceCents ?? null);
  const [nameError, setNameError] = React.useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError('Dê um nome ao plano');
    const common = { name: name.trim(), priceCents: price ?? 0, sessionsPerMonth: intOrNull(perMonth) };
    try {
      await save.mutateAsync({ id: plan?.id, body: plan ? common : { ...common, serviceId: serviceId || null } });
      toast.success(plan ? 'Alterações salvas' : 'Plano criado ✨');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggle = async () => {
    if (!plan) return;
    try {
      await save.mutateAsync({ id: plan.id, body: { active: !plan.active } });
      toast.success(plan.active ? 'Plano desativado' : 'Plano reativado');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={plan ? 'Editar plano do clube' : 'Novo plano do clube'} description="A mensalidade é recebida na comanda, todo mês.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="mem-name" error={nameError}>
          <Input id="mem-name" value={name} invalid={!!nameError} maxLength={120} autoFocus={!plan} placeholder="Ex.: Clube do corte" onChange={(e) => (setName(e.target.value), setNameError(undefined))} />
        </Field>
        <Field label="Mensalidade" htmlFor="mem-price">
          <MoneyInput id="mem-price" value={price} onChange={setPrice} />
        </Field>
        <Field label={vocab.service} htmlFor="mem-service" hint="O que o plano cobre">
          <ServiceSelect id="mem-service" value={serviceId} onChange={setServiceId} optional disabled={!!plan} />
        </Field>
        <Field label="Sessões por mês" htmlFor="mem-sessions" hint="Vazio = ilimitado">
          <Input id="mem-sessions" type="number" inputMode="numeric" min={1} max={100} value={perMonth} onChange={(e) => setPerMonth(e.target.value)} />
        </Field>
        <div className="flex gap-3 pt-2">
          {plan ? (
            <Button type="button" variant={plan.active ? 'danger' : 'soft'} onClick={toggle} disabled={save.isPending}>
              {plan.active ? 'Desativar' : 'Reativar'}
            </Button>
          ) : null}
          <Button type="submit" block loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
