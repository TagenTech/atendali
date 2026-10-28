'use client';

import type { ClientDto } from '@agendei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useSaveClient } from '@/lib/queries/agenda';

export function ClientSheet({ client, onOpenChange, onSaved }: { client: ClientDto | null; onOpenChange: (v: boolean) => void; onSaved?: (c: ClientDto) => void }) {
  const { vocab } = useOrg();
  const save = useSaveClient();
  const [name, setName] = React.useState(client?.name ?? '');
  const [phone, setPhone] = React.useState(client?.phone ?? '');
  const [email, setEmail] = React.useState(client?.email ?? '');
  const [birthDate, setBirthDate] = React.useState(client?.birthDate ?? '');
  const [notes, setNotes] = React.useState(client?.notes ?? '');
  const [tags, setTags] = React.useState(client?.tags.join(', ') ?? '');
  const [nameError, setNameError] = React.useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError('Informe o nome');
    try {
      const saved = await save.mutateAsync({
        id: client?.id,
        body: {
          name: name.trim(),
          phone: phone || null,
          email: email.trim() || null,
          birthDate: birthDate || null,
          notes: notes.trim() || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        },
      });
      toast.success(client ? 'Cadastro atualizado' : `${vocab.client} cadastrado ✨`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={client ? `Editar ${vocab.client.toLowerCase()}` : `Novo ${vocab.client.toLowerCase()}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="cl-name" error={nameError}>
          <Input id="cl-name" value={name} maxLength={120} invalid={!!nameError} autoFocus={!client} onChange={(e) => (setName(e.target.value), setNameError(undefined))} />
        </Field>
        <Field label="Celular / WhatsApp" htmlFor="cl-phone">
          <PhoneInput id="cl-phone" value={phone} onChange={setPhone} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" htmlFor="cl-email">
            <Input id="cl-email" type="email" value={email} maxLength={180} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Nascimento" htmlFor="cl-birth">
            <Input id="cl-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Etiquetas" htmlFor="cl-tags" hint="Separadas por vírgula (ex.: vip, indicação)">
          <Input id="cl-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label="Observações" htmlFor="cl-notes" hint="Alergias, preferências… Guardadas com criptografia.">
          <Textarea id="cl-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" block loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Sheet>
  );
}
