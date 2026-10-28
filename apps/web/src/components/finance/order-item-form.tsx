'use client';

import { Feature, formatBRL, formatDateShort, OrderItemKind, type OrderDto, type OrderItemInput } from '@skedulei/contracts';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { useOrg } from '@/lib/org';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useMembers, useServices } from '@/lib/queries/org';
import { useClientPackages, useMemberships, useMembershipPlans, usePackagePlans, useProducts } from '@/lib/queries/retention';

const selectCls = 'h-13 w-full rounded-2xl border-2 border-input bg-card px-3 outline-none focus:border-primary';

type Kind = OrderItemKind;

/** Formulário de "Adicionar item" da comanda: serviço, produto, pacote, clube e vale, conforme os módulos ligados. */
export function OrderItemForm({ order, pending, onAdd }: { order: OrderDto; pending: boolean; onAdd: (body: OrderItemInput) => Promise<boolean> }) {
  const { has, vocab } = useOrg();
  const hasClient = !!order.clientId;
  const [kind, setKind] = React.useState<Kind>(OrderItemKind.SERVICO);
  const [serviceId, setServiceId] = React.useState('');
  const [refId, setRefId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [price, setPrice] = React.useState<number | null>(null);
  const [quantity, setQuantity] = React.useState('1');

  const services = (useServices().data ?? []).filter((s) => s.active);
  const pros = (useMembers().data ?? []).filter((m) => m.bookable);
  const products = (useProducts(kind === 'PRODUTO').data ?? []).filter((p) => p.active && p.kind === 'VENDA');
  const packagePlans = (usePackagePlans(kind === 'PACOTE').data ?? []).filter((p) => p.active);
  const clubPlans = (useMembershipPlans(kind === 'CLUBE').data ?? []).filter((p) => p.active);
  const myPackages = useClientPackages({ clientId: order.clientId ?? undefined, active: true, enabled: kind === 'SESSAO_PACOTE' && hasClient }).data ?? [];
  const myMemberships = (useMemberships({ clientId: order.clientId ?? undefined, enabled: kind === 'SESSAO_CLUBE' && hasClient }).data ?? []).filter((m) => m.canUse);

  const kinds: { kind: Kind; label: string; needsClient?: boolean }[] = [
    { kind: 'SERVICO', label: vocab.service },
    ...(has(Feature.ESTOQUE) ? [{ kind: 'PRODUTO' as const, label: 'Produto' }] : []),
    { kind: 'AVULSO', label: has(Feature.ESTOQUE) ? 'Avulso' : 'Produto / avulso' },
    ...(has(Feature.PACOTES) ? [{ kind: 'PACOTE' as const, label: 'Vender pacote', needsClient: true }, { kind: 'SESSAO_PACOTE' as const, label: 'Usar pacote', needsClient: true }] : []),
    ...(has(Feature.ASSINATURAS) ? [{ kind: 'CLUBE' as const, label: 'Mensalidade do clube', needsClient: true }, { kind: 'SESSAO_CLUBE' as const, label: 'Usar clube', needsClient: true }] : []),
    ...(has(Feature.VALES) ? [{ kind: 'VALE' as const, label: 'Vale-presente' }] : []),
  ];
  const needsClient = kinds.find((k) => k.kind === kind)?.needsClient && !hasClient;
  const { errors, fail } = useFieldErrors();
  const choose = (k: Kind) => (setKind(k), setRefId(''), setServiceId(''), fail({}));
  // Sessões e produtos pedem profissional; venda de plano/vale não.
  const showMember = kind === 'SERVICO' || kind === 'AVULSO' || kind === 'PRODUTO' || kind === 'SESSAO_PACOTE' || kind === 'SESSAO_CLUBE';
  const club = myMemberships.find((m) => m.id === refId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = showMember ? { memberId: memberId || null } : {};
    let body: OrderItemInput;
    switch (kind) {
      case 'SERVICO':
        if (!fail({ 'it-service': !serviceId && `Escolha o ${vocab.service.toLowerCase()}` })) return;
        body = { kind, serviceId, ...member };
        break;
      case 'AVULSO':
        if (!fail({ 'it-desc': !desc.trim() && 'Descreva o item', 'it-price': !price && 'Informe o valor' }) || !price) return;
        body = { kind, description: desc.trim(), unitPriceCents: price, ...member };
        break;
      case 'PRODUTO': {
        const q = Math.trunc(Number(quantity));
        if (!fail({ 'it-product': !refId && 'Escolha o produto', 'it-qty': !(q >= 1) && 'Use 1 ou mais' })) return;
        body = { kind, refId, quantity: q, ...member };
        break;
      }
      case 'VALE':
        if (!fail({ 'it-gift': !price && 'Informe o valor do vale' }) || !price) return;
        body = { kind, unitPriceCents: price };
        break;
      case 'SESSAO_CLUBE':
        if (!fail({ 'it-mymem': !refId && 'Escolha a assinatura', 'it-clubsvc': !refId ? false : !(club?.serviceId ?? serviceId) && `Escolha o ${vocab.service.toLowerCase()}` })) return;
        body = { kind, refId, serviceId: club?.serviceId ?? serviceId, ...member };
        break;
      default:
        if (!fail({ [kind === 'PACOTE' ? 'it-pkg' : kind === 'CLUBE' ? 'it-club' : 'it-mypkg']: !refId && (kind === 'PACOTE' ? 'Escolha o pacote' : kind === 'CLUBE' ? 'Escolha o plano' : 'Escolha o pacote do cliente') })) return;
        body = { kind, refId, ...member };
    }
    if (await onAdd(body)) {
      setRefId('');
      setServiceId('');
      setDesc('');
      setPrice(null);
      setQuantity('1');
    }
  };

  return (
    <Card>
      <form onSubmit={submit} onChange={() => errors && Object.keys(errors).length && fail({})} className="space-y-3" noValidate>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de item">
          {kinds.map((k) => (
            <Chip key={k.kind} active={kind === k.kind} onClick={() => choose(k.kind)}>
              {k.label}
            </Chip>
          ))}
        </div>

        {needsClient ? (
          <p className="rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning-soft-foreground">Escolha {vocab.client.toLowerCase() === 'paciente' ? 'o paciente' : 'o cliente'} da comanda primeiro.</p>
        ) : null}

        {kind === 'SERVICO' ? (
          <Field label={vocab.service} htmlFor="it-service" error={errors['it-service']}>
            <select id="it-service" className={selectCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Escolha…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatBRL(s.priceCents)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === 'AVULSO' ? (
          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
            <Field label="Descrição" htmlFor="it-desc" error={errors['it-desc']}>
              <Input id="it-desc" invalid={!!errors['it-desc']} maxLength={160} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Pomada" />
            </Field>
            <Field label="Valor" htmlFor="it-price" error={errors['it-price']}>
              <MoneyInput id="it-price" invalid={!!errors['it-price']} value={price} onChange={setPrice} />
            </Field>
          </div>
        ) : null}

        {kind === 'PRODUTO' ? (
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <Field label="Produto" htmlFor="it-product" error={errors['it-product']}>
              <select id="it-product" className={selectCls} value={refId} onChange={(e) => setRefId(e.target.value)}>
                <option value="">Escolha…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatBRL(p.salePriceCents ?? 0)} ({p.quantity} {p.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qtd." htmlFor="it-qty" error={errors['it-qty']}>
              <Input id="it-qty" invalid={!!errors['it-qty']} type="number" inputMode="numeric" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
          </div>
        ) : null}

        {kind === 'PACOTE' && hasClient ? (
          <Field label="Pacote" htmlFor="it-pkg" error={errors['it-pkg']}>
            <select id="it-pkg" className={selectCls} value={refId} onChange={(e) => setRefId(e.target.value)}>
              <option value="">Escolha…</option>
              {packagePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatBRL(p.priceCents)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === 'CLUBE' && hasClient ? (
          <Field label="Plano do clube" htmlFor="it-club" error={errors['it-club']} hint="Cobra a mensalidade; a assinatura é criada ou renovada ao fechar">
            <select id="it-club" className={selectCls} value={refId} onChange={(e) => setRefId(e.target.value)}>
              <option value="">Escolha…</option>
              {clubPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatBRL(p.priceCents)}/mês
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === 'VALE' ? (
          <Field label="Valor do vale" htmlFor="it-gift" error={errors['it-gift']} hint="O código é gerado quando a comanda for paga">
            <MoneyInput id="it-gift" invalid={!!errors['it-gift']} value={price} onChange={setPrice} />
          </Field>
        ) : null}

        {kind === 'SESSAO_PACOTE' && hasClient ? (
          <Field label="Pacote do cliente" htmlFor="it-mypkg" error={errors['it-mypkg']}>
            <select id="it-mypkg" className={selectCls} value={refId} onChange={(e) => setRefId(e.target.value)}>
              <option value="">{myPackages.length ? 'Escolha…' : 'Nenhum pacote com saldo'}</option>
              {myPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planName} · {p.sessionsLeft} restantes{p.expiresAt ? ` · até ${formatDateShort(p.expiresAt)}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === 'SESSAO_CLUBE' && hasClient ? (
          <>
            <Field label="Assinatura" htmlFor="it-mymem" error={errors['it-mymem']}>
              <select id="it-mymem" className={selectCls} value={refId} onChange={(e) => setRefId(e.target.value)}>
                <option value="">{myMemberships.length ? 'Escolha…' : 'Nenhuma assinatura em dia'}</option>
                {myMemberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.planName}
                    {m.sessionsPerMonth ? ` · ${m.sessionsUsedInCycle}/${m.sessionsPerMonth} no mês` : ' · ilimitado'}
                  </option>
                ))}
              </select>
            </Field>
            {club && !club.serviceId ? (
              <Field label={vocab.service} htmlFor="it-clubsvc" error={errors['it-clubsvc']}>
                <select id="it-clubsvc" className={selectCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        ) : null}

        {showMember ? (
          <Field label="Profissional (comissão)" htmlFor="it-member" error={errors['it-member']}>
            <select id="it-member" className={selectCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Ninguém</option>
              {pros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Button type="submit" variant="soft" block loading={pending} disabled={!!needsClient}>
          Adicionar item
        </Button>
      </form>
    </Card>
  );
}
