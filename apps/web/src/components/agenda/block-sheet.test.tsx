import type { AgendaDayDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const agenda = vi.hoisted(() => ({ useCreateBlock: vi.fn(), useRemoveBlock: vi.fn() }));
vi.mock('@/lib/queries/agenda', () => agenda);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { BlockSheet } from './block-sheet';

const day = (blocks: AgendaDayDto['blocks'] = []): AgendaDayDto =>
  ({
    date: '2026-10-28',
    timezone: 'America/Sao_Paulo',
    professionals: [{ id: 'm1', name: 'Bia' }, { id: 'm2', name: 'Caio' }],
    blocks,
  }) as unknown as AgendaDayDto;

let create: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let remove: { mutateAsync: ReturnType<typeof vi.fn> };
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

function show(d = day()) {
  const onOpenChange = vi.fn();
  render(<BlockSheet day={d} onOpenChange={onOpenChange} />);
  return onOpenChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  create = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  remove = { mutateAsync: vi.fn().mockResolvedValue({}) };
  agenda.useCreateBlock.mockImplementation(() => create);
  agenda.useRemoveBlock.mockImplementation(() => remove);
});

describe('BlockSheet', () => {
  it('quem gerencia a agenda toda pode bloquear a unidade inteira', async () => {
    orgState.permissions = ['agenda.manage_all'];
    const onOpenChange = show();
    expect((screen.getByLabelText('Para quem') as HTMLSelectElement).value).toBe('');
    type('Motivo (opcional)', ' Feriado ');
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create.mutateAsync).toHaveBeenCalledWith({
      memberId: null,
      startsAt: '2026-10-28T15:00:00.000Z',
      endsAt: '2026-10-28T16:00:00.000Z',
      reason: 'Feriado',
    });
    expect(toast.success).toHaveBeenCalledWith('Horário bloqueado');
  });

  it('bloqueia um profissional, sem motivo (null)', async () => {
    orgState.permissions = ['agenda.manage_all'];
    show();
    type('Para quem', 'm2');
    type('Das', '09:00');
    type('Às', '09:30');
    submit();
    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalled());
    expect(create.mutateAsync).toHaveBeenCalledWith({ memberId: 'm2', startsAt: '2026-10-28T12:00:00.000Z', endsAt: '2026-10-28T12:30:00.000Z', reason: null });
  });

  it('quem só cuida da própria agenda não vê "unidade inteira" e já vem com o próprio nome', () => {
    show();
    expect(screen.queryByRole('option', { name: 'Unidade inteira' })).toBeNull();
    expect((screen.getByLabelText('Para quem') as HTMLSelectElement).value).toBe('m1');
  });

  it('sem profissional escolhido (e sem poder bloquear todos) pede a escolha', () => {
    orgState.org = { ...orgState.org, me: { memberId: '' } };
    show();
    submit();
    expect(alerts()).toEqual(['Escolha quem fica bloqueado']);
    type('Para quem', 'm1');
    expect(alerts()).toEqual([]);
  });

  it('valida início, fim e a ordem entre eles', () => {
    show();
    type('Das', '');
    type('Às', '');
    submit();
    expect(alerts()).toEqual(['Informe a hora de início', 'Informe a hora de fim']);
    type('Das', '14:00');
    type('Às', '13:00');
    submit();
    expect(alerts()).toEqual(['O fim precisa ser depois do início']);
    // mexer no início limpa também o aviso do fim
    type('Das', '10:00');
    expect(alerts()).toEqual([]);
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('erro da API vira aviso', async () => {
    create.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Já existe um bloqueio nesse horário']));
    const onOpenChange = show();
    submit();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um bloqueio nesse horário'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('lista os bloqueios do dia e remove', async () => {
    const blocks = [
      { id: 'b1', memberId: null, startsAt: '2026-10-28T15:00:00.000Z', endsAt: '2026-10-28T16:00:00.000Z', reason: 'Almoço' },
      { id: 'b2', memberId: 'm2', startsAt: '2026-10-28T17:00:00.000Z', endsAt: '2026-10-28T18:00:00.000Z', reason: null },
      { id: 'b3', memberId: 'zz', startsAt: '2026-10-28T19:00:00.000Z', endsAt: '2026-10-28T20:00:00.000Z', reason: null },
    ] as AgendaDayDto['blocks'];
    show(day(blocks));
    expect(screen.getByText('Bloqueios deste dia')).toBeTruthy();
    expect(screen.getByText(/12:00–13:00/).parentElement!.textContent).toMatch(/Unidade inteira · Almoço/);
    expect(screen.getByText(/14:00–15:00/).parentElement!.textContent).toMatch(/Caio/);
    expect(screen.getByText(/16:00–17:00/).parentElement!.textContent).toMatch(/Profissional/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover bloqueio' })[0]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Bloqueio removido'));
    expect(remove.mutateAsync).toHaveBeenCalledWith('b1');
    remove.mutateAsync.mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover bloqueio' })[1]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar'));
  });

  it('sem bloqueios não mostra a seção', () => {
    show();
    expect(screen.queryByText('Bloqueios deste dia')).toBeNull();
  });
});
