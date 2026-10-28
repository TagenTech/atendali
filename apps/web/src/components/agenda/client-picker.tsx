'use client';

import type { ClientDto } from '@agendei/contracts';
import { Check, Search, UserPlus, X } from 'lucide-react';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { useOrg } from '@/lib/org';
import { useClients } from '@/lib/queries/agenda';

export type PickedClient = { client: Pick<ClientDto, 'id' | 'name'>; newClient?: never } | { client?: never; newClient: { name: string; phone: string } } | null;

/** Busca um cliente pelo nome/celular ou cadastra um novo na hora. */
export function ClientPicker({ value, onChange, locked }: { value: PickedClient; onChange: (v: PickedClient) => void; locked?: boolean }) {
  const { vocab } = useOrg();
  const [query, setQuery] = React.useState('');
  const found = useClients(query.trim()).data ?? [];

  if (value?.client) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft px-4 py-3">
        <Check className="size-4 text-primary" />
        <span className="flex-1 font-semibold">{value.client.name}</span>
        {locked ? null : (
          <button type="button" aria-label={`Trocar ${vocab.client.toLowerCase()}`} onClick={() => onChange(null)} className="text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }
  if (value?.newClient) {
    const nc = value.newClient;
    return (
      <div className="space-y-2 rounded-2xl border-2 border-input p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-primary">Novo cadastro</span>
          <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-muted-foreground">
            Voltar à busca
          </button>
        </div>
        <Input aria-label="Nome do novo cadastro" value={nc.name} onChange={(e) => onChange({ newClient: { ...nc, name: e.target.value } })} />
        <PhoneInput aria-label="Celular do novo cadastro" value={nc.phone} onChange={(phone) => onChange({ newClient: { ...nc, phone } })} />
      </div>
    );
  }
  return (
    <>
      <Input icon={<Search />} aria-label={`Buscar ${vocab.client.toLowerCase()}`} placeholder="Nome ou celular" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query.trim() ? (
        <ul className="max-h-48 overflow-y-auto rounded-2xl border border-border">
          {found.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onChange({ client: c })} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted">
                <span className="font-semibold">{c.name}</span>
                <span className="text-sm text-muted-foreground">{c.phone ?? ''}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onChange({ newClient: { name: /\d/.test(query) ? '' : query.trim(), phone: /\d/.test(query) ? query : '' } })}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-semibold text-primary hover:bg-primary-soft"
            >
              <UserPlus className="size-4" /> Cadastrar “{query.trim()}”
            </button>
          </li>
        </ul>
      ) : null}
    </>
  );
}

/** Corpo da requisição a partir do cliente escolhido. */
export const clientBody = (v: NonNullable<PickedClient>) =>
  v.client ? { clientId: v.client.id } : { newClient: { name: v.newClient.name.trim(), phone: v.newClient.phone || null } };
