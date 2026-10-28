'use client';

import { defaultBusinessHours, validateBusinessHours, type UnitDto } from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Sheet } from '@/components/ui/sheet';
import { errorText } from '@/lib/api/client';
import { useSaveUnit } from '@/lib/queries/org';
import { BusinessHoursEditor } from './business-hours-editor';

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export function UnitSheet({ open, onOpenChange, unit }: { open: boolean; onOpenChange: (v: boolean) => void; unit: UnitDto | null }) {
  const save = useSaveUnit();
  const [name, setName] = React.useState(unit?.name ?? '');
  const [phone, setPhone] = React.useState(unit?.phone ?? '');
  const [street, setStreet] = React.useState(unit?.street ?? '');
  const [number, setNumber] = React.useState(unit?.number ?? '');
  const [district, setDistrict] = React.useState(unit?.district ?? '');
  const [city, setCity] = React.useState(unit?.city ?? '');
  const [state, setState] = React.useState(unit?.state ?? '');
  const [hours, setHours] = React.useState(unit?.businessHours ?? defaultBusinessHours());
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !name.trim() ? 'Dê um nome para a unidade' : validateBusinessHours(hours);
    setError(problem);
    if (problem) return;
    try {
      await save.mutateAsync({
        id: unit?.id,
        body: {
          name: name.trim(),
          phone: phone || null,
          street: street.trim() || null,
          number: number.trim() || null,
          district: district.trim() || null,
          city: city.trim() || null,
          state: state || null,
          businessHours: hours,
        },
      });
      toast.success(unit ? 'Unidade atualizada' : 'Unidade criada');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={unit ? unit.name : 'Nova unidade'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome da unidade" htmlFor="u-name" hint="Ex.: Centro, Shopping Norte">
          <Input id="u-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Telefone" htmlFor="u-phone">
          <PhoneInput id="u-phone" value={phone} onChange={setPhone} />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Rua" htmlFor="u-street">
            <Input id="u-street" value={street} maxLength={120} onChange={(e) => setStreet(e.target.value)} />
          </Field>
          <Field label="Número" htmlFor="u-number">
            <Input id="u-number" value={number} maxLength={20} onChange={(e) => setNumber(e.target.value)} />
          </Field>
        </div>
        <Field label="Bairro" htmlFor="u-district">
          <Input id="u-district" value={district} maxLength={80} onChange={(e) => setDistrict(e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Cidade" htmlFor="u-city">
            <Input id="u-city" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="UF" htmlFor="u-uf">
            <select id="u-uf" value={state} onChange={(e) => setState(e.target.value)} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3 outline-none focus:border-primary">
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <section className="space-y-2">
          <h3 className="pl-1 text-sm font-semibold">Horário de funcionamento</h3>
          <BusinessHoursEditor value={hours} onChange={setHours} />
        </section>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" block loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Sheet>
  );
}
