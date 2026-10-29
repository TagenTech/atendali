import type { ProductDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
const retention = vi.hoisted(() => ({ useCreateMovement: vi.fn() }));
vi.mock('@/lib/queries/retention', () => retention);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { MovementSheet } from './movement-sheet';

const product = { id: 'p1', name: 'Pomada', quantity: 5, unit: 'un' } as ProductDto;
let move: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show() {
  const onOpenChange = vi.fn();
  render(<MovementSheet open onOpenChange={onOpenChange} product={product} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const chip = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Lançar' }));
const alert = () => screen.queryByRole('alert')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  move = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  retention.useCreateMovement.mockImplementation(() => move);
});

describe('MovementSheet', () => {
  it('mostra o produto e o saldo; entrada é o padrão e aceita custo', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Pomada' })).toBeTruthy();
    expect(screen.getByText('Em estoque: 5 un')).toBeTruthy();
    expect(screen.getByText(/atualiza o custo médio/)).toBeTruthy();
    expect(screen.getByLabelText('Custo por unidade')).toBeTruthy();
  });

  it('cada tipo tem a sua dica; só a entrada pede custo; inventário fala em quantidade contada', () => {
    show();
    chip('Saída');
    expect(screen.getByText(/Perda, validade/)).toBeTruthy();
    expect(screen.queryByLabelText('Custo por unidade')).toBeNull();
    chip('Inventário');
    expect(screen.getByText(/informe a quantidade contada/)).toBeTruthy();
    expect(screen.getByLabelText('Quantidade contada')).toBeTruthy();
  });

  it('recusa quantidade vazia, quebrada ou zero (menos no inventário)', async () => {
    show();
    send();
    expect(alert()).toBe('Informe a quantidade');
    type('Quantidade', '0');
    send();
    expect(alert()).toBe('Informe a quantidade');
    type('Quantidade', '1.5');
    send();
    expect(alert()).toBe('Informe a quantidade');
    type('Quantidade', '-2');
    send();
    expect(alert()).toBe('Informe a quantidade');
    chip('Inventário');
    expect(alert()).toBeUndefined();
    send();
    expect(alert()).toBe('Informe a quantidade contada');
    expect(move.mutateAsync).not.toHaveBeenCalled();
    type('Quantidade contada', '0');
    expect(alert()).toBeUndefined();
    send();
    await waitFor(() => expect(move.mutateAsync).toHaveBeenCalledWith({ productId: 'p1', kind: 'AJUSTE', quantity: 0, unitCostCents: undefined, note: null }));
  });

  it('entrada com custo e observação', async () => {
    const onOpenChange = show();
    type('Quantidade', '3');
    type('Custo por unidade', '250');
    type(/Observação/, ' compra ');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(move.mutateAsync).toHaveBeenCalledWith({ productId: 'p1', kind: 'ENTRADA', quantity: 3, unitCostCents: 250, note: 'compra' });
    expect(toast.success).toHaveBeenCalledWith('Estoque atualizado');
  });

  it('entrada sem custo não manda custo; saída nunca manda', async () => {
    show();
    type('Quantidade', '2');
    send();
    await waitFor(() => expect(move.mutateAsync).toHaveBeenCalledTimes(1));
    expect(move.mutateAsync.mock.calls[0][0].unitCostCents).toBeUndefined();
    type('Custo por unidade', '500');
    chip('Saída');
    send();
    await waitFor(() => expect(move.mutateAsync).toHaveBeenCalledTimes(2));
    expect(move.mutateAsync.mock.calls[1][0]).toMatchObject({ kind: 'SAIDA', unitCostCents: undefined });
  });

  it('erro da API vira aviso e o painel fica aberto', async () => {
    move.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Estoque insuficiente']));
    const onOpenChange = show();
    chip('Saída');
    type('Quantidade', '9');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Estoque insuficiente'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
