import type { MembershipPlanDto, PackagePlanDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useServices: vi.fn(), useSavePackagePlan: vi.fn(), useSaveMembershipPlan: vi.fn() }));
vi.mock('@/lib/queries/org', () => ({ useServices: q.useServices }));
vi.mock('@/lib/queries/retention', () => ({ useSavePackagePlan: q.useSavePackagePlan, useSaveMembershipPlan: q.useSaveMembershipPlan }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { resetOrg } from '@/test/org-stub';
import { MembershipPlanSheet, PackagePlanSheet } from './plan-sheets';

let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  q.useSavePackagePlan.mockImplementation(() => save);
  q.useSaveMembershipPlan.mockImplementation(() => save);
  q.useServices.mockReturnValue({ data: [{ id: 's1', name: 'Corte', active: true }, { id: 's2', name: 'Velho', active: false }] });
});

const pkg = { id: 'pk1', name: '5 cortes', serviceId: 's1', sessions: 5, priceCents: 20000, validityDays: 90, active: true } as PackagePlanDto;
const club = { id: 'cb1', name: 'Clube do corte', serviceId: null, priceCents: 9900, sessionsPerMonth: 4, active: false } as MembershipPlanDto;

describe('PackagePlanSheet', () => {
  function show(plan: PackagePlanDto | null = null) {
    const onOpenChange = vi.fn();
    render(<PackagePlanSheet open onOpenChange={onOpenChange} plan={plan} />);
    return onOpenChange;
  }

  it('novo: cada pendência com a sua mensagem; o erro some ao digitar', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Novo pacote' })).toBeTruthy();
    type('Sessões', '1');
    send();
    expect(alerts()).toEqual(['Dê um nome ao pacote', 'Escolha o serviço', 'Um pacote tem pelo menos 2 sessões']);
    type('Nome', 'x');
    expect(alerts()).toEqual([]);
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('só oferece serviços ativos', () => {
    show();
    const options = within(screen.getByLabelText('Serviço')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Escolha…', 'Corte']);
  });

  it('cria com serviço, sessões, preço e validade', async () => {
    const onOpenChange = show();
    type('Nome', ' 10 cortes ');
    type('Serviço', 's1');
    expect(alerts()).toEqual([]);
    type('Sessões', '10');
    type('Validade (dias)', '180');
    type('Preço do pacote', '35000');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, body: { name: '10 cortes', sessions: 10, priceCents: 35000, validityDays: 180, serviceId: 's1' } });
    expect(toast.success).toHaveBeenCalledWith('Pacote criado ✨');
  });

  it('sem validade nem preço: validade null e preço 0', async () => {
    show();
    type('Nome', 'Pacote');
    type('Serviço', 's1');
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ sessions: 5, priceCents: 0, validityDays: null });
  });

  it('editar: o serviço fica travado e não vai no corpo', async () => {
    show(pkg);
    expect(screen.getByRole('dialog', { name: 'Editar pacote' })).toBeTruthy();
    expect((screen.getByLabelText('Serviço') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Validade (dias)') as HTMLInputElement).value).toBe('90');
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 'pk1', body: { name: '5 cortes', sessions: 5, priceCents: 20000, validityDays: 90 } });
  });

  it('desativar, reativar e erro', async () => {
    save.mutateAsync.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(400, 'x', ['Não deu']));
    const { unmount } = render(<PackagePlanSheet open onOpenChange={vi.fn()} plan={pkg} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pacote desativado'));
    unmount();
    render(<PackagePlanSheet open onOpenChange={vi.fn()} plan={{ ...pkg, active: false }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pacote reativado'));
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não deu'));
  });

  it('erro ao salvar vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(400, 'x', ['Serviço inativo']));
    show();
    type('Nome', 'P');
    type('Serviço', 's1');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Serviço inativo'));
  });
});

describe('MembershipPlanSheet', () => {
  function show(plan: MembershipPlanDto | null = null) {
    const onOpenChange = vi.fn();
    render(<MembershipPlanSheet open onOpenChange={onOpenChange} plan={plan} />);
    return onOpenChange;
  }

  it('novo: exige o nome', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Novo plano do clube' })).toBeTruthy();
    send();
    expect(alerts()).toEqual(['Dê um nome ao plano']);
    type('Nome', 'x');
    expect(alerts()).toEqual([]);
  });

  it('cria ilimitado e para qualquer serviço', async () => {
    const onOpenChange = show();
    type('Nome', ' Clube ');
    type('Mensalidade', '9900');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, body: { name: 'Clube', priceCents: 9900, sessionsPerMonth: null, serviceId: null } });
    expect(toast.success).toHaveBeenCalledWith('Plano criado ✨');
    expect(screen.queryByRole('option', { name: 'Velho' })).toBeNull();
  });

  it('cria com serviço e sessões por mês', async () => {
    show();
    type('Nome', 'Clube');
    type('Serviço', 's1');
    type('Sessões por mês', '4');
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ serviceId: 's1', sessionsPerMonth: 4, priceCents: 0 });
  });

  it('editar: serviço travado; salva só nome, preço e sessões', async () => {
    show(club);
    expect(screen.getByRole('dialog', { name: 'Editar plano do clube' })).toBeTruthy();
    expect((screen.getByLabelText('Serviço') as HTMLSelectElement).disabled).toBe(true);
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 'cb1', body: { name: 'Clube do corte', priceCents: 9900, sessionsPerMonth: 4 } });
  });

  it('reativar o plano desligado, desativar o ligado e erro', async () => {
    save.mutateAsync.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(400, 'x', ['Não deu']));
    const a = render(<MembershipPlanSheet open onOpenChange={vi.fn()} plan={club} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plano reativado'));
    a.unmount();
    render(<MembershipPlanSheet open onOpenChange={vi.fn()} plan={{ ...club, active: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plano desativado'));
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não deu'));
  });

  it('erro ao salvar vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(400, 'x', ['Preço inválido']));
    show();
    type('Nome', 'C');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Preço inválido'));
  });
});
