import type { OrderDto } from '@skedulei/contracts';
import { fireEvent, render as rtl, screen, waitFor } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({
  useServices: vi.fn(),
  useMembers: vi.fn(),
  useProducts: vi.fn(),
  usePackagePlans: vi.fn(),
  useMembershipPlans: vi.fn(),
  useClientPackages: vi.fn(),
  useMemberships: vi.fn(),
}));
vi.mock('@/lib/queries/org', () => ({ useServices: q.useServices, useMembers: q.useMembers }));
vi.mock('@/lib/queries/retention', () => ({
  useProducts: q.useProducts,
  usePackagePlans: q.usePackagePlans,
  useMembershipPlans: q.useMembershipPlans,
  useClientPackages: q.useClientPackages,
  useMemberships: q.useMemberships,
}));

import { orgState, resetOrg } from '@/test/org-stub';
import { OrderItemForm } from './order-item-form';

const order = (clientId: string | null = 'cl1') => ({ id: 'o1', clientId }) as OrderDto;
const data = <T,>(d: T) => ({ data: d });

const renderWith = (ui: React.ReactElement) => rtl(ui);

function render(opts: { clientId?: string | null; onAdd?: (b: unknown) => Promise<boolean>; pending?: boolean } = {}) {
  const onAdd = vi.fn(opts.onAdd ?? (async () => true));
  const view = renderWith(<OrderItemForm order={order(opts.clientId === undefined ? 'cl1' : opts.clientId)} pending={opts.pending ?? false} onAdd={onAdd} />);
  return { onAdd, ...view };
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const chip = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const add = () => fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  q.useServices.mockReturnValue(
    data([
      { id: 's1', name: 'Corte', priceCents: 5000, active: true },
      { id: 's2', name: 'Escova', priceCents: 7000, active: true },
      { id: 's3', name: 'Antigo', priceCents: 1000, active: false },
    ]),
  );
  q.useMembers.mockReturnValue(data([{ id: 'm1', name: 'Bia', bookable: true }, { id: 'm2', name: 'Caixa', bookable: false }]));
  q.useProducts.mockReturnValue(
    data([
      { id: 'p1', name: 'Pomada', kind: 'VENDA', active: true, salePriceCents: 3000, quantity: 4, unit: 'un' },
      { id: 'p2', name: 'Insumo', kind: 'INSUMO', active: true, salePriceCents: null, quantity: 9, unit: 'ml' },
    ]),
  );
  q.usePackagePlans.mockReturnValue(data([{ id: 'pk1', name: 'Pacote 5', priceCents: 40000, active: true }]));
  q.useMembershipPlans.mockReturnValue(data([{ id: 'cb1', name: 'Clube Ouro', priceCents: 9900, active: true }]));
  q.useClientPackages.mockReturnValue(data([{ id: 'cp1', planName: 'Pacote 5', sessionsLeft: 3, expiresAt: '2026-12-31' }, { id: 'cp2', planName: 'Pacote 10', sessionsLeft: 8, expiresAt: null }]));
  q.useMemberships.mockReturnValue(
    data([
      { id: 'ms1', planName: 'Clube Ouro', sessionsPerMonth: 4, sessionsUsedInCycle: 1, canUse: true, serviceId: 's1' },
      { id: 'ms2', planName: 'Clube Livre', sessionsPerMonth: null, sessionsUsedInCycle: 0, canUse: true, serviceId: null },
      { id: 'ms3', planName: 'Clube Vencido', sessionsPerMonth: 2, sessionsUsedInCycle: 2, canUse: false, serviceId: null },
    ]),
  );
});

describe('OrderItemForm', () => {
  it('os tipos de item dependem dos módulos ligados', () => {
    const { unmount } = render();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Serviço', 'Produto / avulso', 'Adicionar item']);
    unmount();
    orgState.features = ['ESTOQUE', 'PACOTES', 'ASSINATURAS', 'VALES'];
    render();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Serviço',
      'Produto',
      'Avulso',
      'Vender pacote',
      'Usar pacote',
      'Mensalidade do clube',
      'Usar clube',
      'Vale-presente',
      'Adicionar item',
    ]);
  });

  it('serviço: exige a escolha, lista só os ativos e entrega o item (com ou sem profissional)', async () => {
    const { onAdd } = render();
    add();
    expect(alerts()).toEqual(['Escolha o serviço']);
    expect(screen.queryByRole('option', { name: /Antigo/ })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Caixa' })).toBeNull();
    type('Serviço', 's2');
    expect(alerts()).toEqual([]);
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'SERVICO', serviceId: 's2', memberId: null }));
    // depois de adicionar, o campo volta ao início
    expect((screen.getByLabelText('Serviço') as HTMLSelectElement).value).toBe('');
    type('Serviço', 's1');
    type('Profissional (comissão)', 'm1');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenLastCalledWith({ kind: 'SERVICO', serviceId: 's1', memberId: 'm1' }));
  });

  it('se o item não foi adicionado (a API recusou), mantém o que foi digitado', async () => {
    const { onAdd } = render({ onAdd: async () => false });
    type('Serviço', 's1');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect((screen.getByLabelText('Serviço') as HTMLSelectElement).value).toBe('s1');
  });

  it('avulso: pede descrição e valor', async () => {
    orgState.features = ['ESTOQUE'];
    const { onAdd } = render();
    chip('Avulso');
    add();
    expect(alerts()).toEqual(['Descreva o item', 'Informe o valor']);
    type('Descrição', ' Pomada ');
    type('Valor', '2500');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'AVULSO', description: 'Pomada', unitPriceCents: 2500, memberId: null }));
    expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe('');
  });

  it('produto: só os de venda, quantidade de 1 para cima', async () => {
    orgState.features = ['ESTOQUE'];
    const { onAdd } = render();
    chip('Produto');
    expect(q.useProducts).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('option', { name: /Insumo/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Pomada · .*30,00 \(4 un\)/ })).toBeTruthy();
    add();
    expect(alerts()).toEqual(['Escolha o produto']);
    type('Produto', 'p1');
    type('Qtd.', '0');
    add();
    expect(alerts()).toEqual(['Use 1 ou mais']);
    type('Qtd.', '2');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'PRODUTO', refId: 'p1', quantity: 2, memberId: null }));
    expect((screen.getByLabelText('Qtd.') as HTMLInputElement).value).toBe('1');
  });

  it('vale-presente: valor obrigatório, sem profissional', async () => {
    orgState.features = ['VALES'];
    const { onAdd } = render({ clientId: null });
    chip('Vale-presente');
    expect(screen.queryByLabelText('Profissional (comissão)')).toBeNull();
    add();
    expect(alerts()).toEqual(['Informe o valor do vale']);
    type('Valor do vale', '10000');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'VALE', unitPriceCents: 10000 }));
  });

  it('pacote e clube pedem a pessoa da comanda primeiro (com o vocabulário do negócio)', () => {
    orgState.features = ['PACOTES', 'ASSINATURAS'];
    orgState.vocab = { ...orgState.vocab, client: 'Paciente' };
    render({ clientId: null });
    chip('Vender pacote');
    expect(screen.getByText('Escolha o paciente da comanda primeiro.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Adicionar item' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Pacote')).toBeNull();
    chip('Mensalidade do clube');
    expect(screen.getByText('Escolha o paciente da comanda primeiro.')).toBeTruthy();
  });

  it('com cliente de outro vocabulário o aviso diz "o cliente"', () => {
    orgState.features = ['PACOTES'];
    render({ clientId: null });
    chip('Usar pacote');
    expect(screen.getByText('Escolha o cliente da comanda primeiro.')).toBeTruthy();
  });

  it('vender pacote e plano do clube', async () => {
    orgState.features = ['PACOTES', 'ASSINATURAS'];
    const { onAdd } = render();
    chip('Vender pacote');
    add();
    expect(alerts()).toEqual(['Escolha o pacote']);
    type('Pacote', 'pk1');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'PACOTE', refId: 'pk1' }));
    chip('Mensalidade do clube');
    add();
    expect(alerts()).toEqual(['Escolha o plano']);
    type('Plano do clube', 'cb1');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenLastCalledWith({ kind: 'CLUBE', refId: 'cb1' }));
  });

  it('usar pacote: lista os pacotes do cliente com saldo e validade', async () => {
    orgState.features = ['PACOTES'];
    const { onAdd } = render();
    chip('Usar pacote');
    expect(q.useClientPackages).toHaveBeenLastCalledWith({ clientId: 'cl1', active: true, enabled: true });
    expect(screen.getByRole('option', { name: /Pacote 5 · 3 restantes · até/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pacote 10 · 8 restantes' })).toBeTruthy();
    add();
    expect(alerts()).toEqual(['Escolha o pacote do cliente']);
    type('Pacote do cliente', 'cp2');
    type('Profissional (comissão)', 'm1');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'SESSAO_PACOTE', refId: 'cp2', memberId: 'm1' }));
  });

  it('usar pacote sem saldo avisa na própria lista', () => {
    orgState.features = ['PACOTES'];
    q.useClientPackages.mockReturnValue({ data: undefined });
    render();
    chip('Usar pacote');
    expect(screen.getByRole('option', { name: 'Nenhum pacote com saldo' })).toBeTruthy();
  });

  it('usar clube: só assinaturas em dia; se o plano não fixa o serviço, pede o serviço', async () => {
    orgState.features = ['ASSINATURAS'];
    const { onAdd } = render();
    chip('Usar clube');
    expect(screen.queryByRole('option', { name: /Vencido/ })).toBeNull();
    expect(screen.getByRole('option', { name: 'Clube Ouro · 1/4 no mês' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Clube Livre · ilimitado' })).toBeTruthy();
    add();
    expect(alerts()).toEqual(['Escolha a assinatura']);

    // plano com serviço fixo: não pergunta o serviço
    type('Assinatura', 'ms1');
    expect(screen.queryByLabelText('Serviço')).toBeNull();
    add();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ kind: 'SESSAO_CLUBE', refId: 'ms1', serviceId: 's1', memberId: null }));

    // plano sem serviço fixo: pergunta
    type('Assinatura', 'ms2');
    add();
    expect(alerts()).toEqual(['Escolha o serviço']);
    type('Serviço', 's2');
    add();
    await waitFor(() => expect(onAdd).toHaveBeenLastCalledWith({ kind: 'SESSAO_CLUBE', refId: 'ms2', serviceId: 's2', memberId: null }));
  });

  it('usar clube sem assinatura em dia avisa na lista', () => {
    orgState.features = ['ASSINATURAS'];
    q.useMemberships.mockReturnValue({ data: undefined });
    render();
    chip('Usar clube');
    expect(screen.getByRole('option', { name: 'Nenhuma assinatura em dia' })).toBeTruthy();
  });

  it('enquanto envia, o botão fica travado', () => {
    orgState.features = ['ESTOQUE'];
    render({ onAdd: async () => true, pending: true });
    expect((screen.getByRole('button', { name: 'Adicionar item' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('trocar de tipo limpa os erros', () => {
    orgState.features = ['ESTOQUE'];
    render();
    add();
    expect(alerts()).toHaveLength(1);
    chip('Avulso');
    expect(alerts()).toEqual([]);
  });
});
