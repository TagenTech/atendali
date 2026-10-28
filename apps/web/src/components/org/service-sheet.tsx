'use client';

import { Feature, formatDuration, type ServiceDto } from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { PercentInput } from '@/components/ui/percent-input';
import { SuppliesEditor } from '@/components/org/supplies-editor';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useSaveService } from '@/lib/queries/org';

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Criar (service = null) ou editar um serviço. Abre com `key` diferente para reiniciar o formulário. */
export function ServiceSheet({
  open,
  onOpenChange,
  service,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: ServiceDto | null;
  categories: string[];
}) {
  const { vocab, has } = useOrg();
  const save = useSaveService();
  const [name, setName] = React.useState(service?.name ?? '');
  const [category, setCategory] = React.useState(service?.category ?? '');
  const [duration, setDuration] = React.useState(service?.durationMinutes ?? 60);
  const [price, setPrice] = React.useState<number | null>(service?.priceCents ?? null);
  const [description, setDescription] = React.useState(service?.description ?? '');
  const [online, setOnline] = React.useState(service?.onlineBooking ?? true);
  const [commission, setCommission] = React.useState<number | null>(service?.commissionBps ?? null);
  const [nameError, setNameError] = React.useState<string>();
  const label = vocab.service.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError(`Dê um nome para o ${label}`);
    try {
      await save.mutateAsync({
        id: service?.id,
        body: {
          name: name.trim(),
          category: category.trim() || null,
          durationMinutes: duration,
          priceCents: price ?? 0,
          description: description.trim() || null,
          onlineBooking: online,
          commissionBps: commission,
        },
      });
      toast.success(service ? 'Alterações salvas' : `${vocab.service} criado ✨`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggleActive = async () => {
    if (!service) return;
    try {
      await save.mutateAsync({ id: service.id, body: { active: !service.active } });
      toast.success(service.active ? `${vocab.service} desativado` : `${vocab.service} reativado`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={service ? `Editar ${label}` : `Novo ${label}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="svc-name" error={nameError}>
          <Input id="svc-name" value={name} invalid={!!nameError} maxLength={120} onChange={(e) => (setName(e.target.value), setNameError(undefined))} autoFocus={!service} />
        </Field>
        <Field label="Categoria" htmlFor="svc-cat" hint="Agrupa a lista (ex.: Cabelo, Unhas, Facial)">
          <Input id="svc-cat" value={category} maxLength={60} list="svc-categories" onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <datalist id="svc-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-semibold">Duração: {formatDuration(duration)}</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </Chip>
            ))}
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Duração em minutos"
              min={5}
              max={720}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Math.max(5, Math.min(720, Number(e.target.value) || 5)))}
              className="h-9 w-24 rounded-full px-3"
              trailing={<span className="text-sm text-muted-foreground">min</span>}
            />
          </div>
        </fieldset>
        <Field label="Preço" htmlFor="svc-price" hint="Deixe em branco para gratuito (ex.: avaliação)">
          <MoneyInput id="svc-price" value={price} onChange={setPrice} />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="svc-desc" hint="Aparece para o cliente no agendamento online">
          <Textarea id="svc-desc" value={description} maxLength={600} rows={3} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Comissão deste item" htmlFor="svc-commission" hint="Vazio = usa a comissão de cada profissional">
          <PercentInput id="svc-commission" value={commission} onChange={setCommission} />
        </Field>
        {service && has(Feature.ESTOQUE) ? <SuppliesEditor serviceId={service.id} /> : null}
        <SwitchRow id="svc-online" checked={online} onCheckedChange={setOnline} title="Agendamento online" description="O cliente pode marcar sozinho pela sua página" />
        <div className="flex gap-3 pt-2">
          {service ? (
            <Button type="button" variant={service.active ? 'danger' : 'soft'} onClick={toggleActive} disabled={save.isPending}>
              {service.active ? 'Desativar' : 'Reativar'}
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
