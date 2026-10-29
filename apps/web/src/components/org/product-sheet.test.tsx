import type { ProductDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
const retention = vi.hoisted(() => ({ useSaveProduct: vi.fn() }));
vi.mock('@/lib/queries/retention', () => retention);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { ProductSheet } from './product-sheet';

const venda = { id: 'p1', name: 'Pomada', kind: 'VENDA', unit: 'un', salePriceCents: 3000, minQuantity: 2, active: true } as ProductDto;
const insumo = { id: 'p2', name: 'Shampoo', kind: 'INSUMO', unit: 'ml', salePriceCents: null, minQuantity: 0, active: false } as ProductDto;
let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(product: ProductDto | null = null) {
  const onOpenChange = vi.fn();
  render(<ProductSheet open onOpenChange={onOpenChange} product={product} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
const alert = () => screen.queryByRole('alert')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  retention.useSaveProduct.mockImplementation(() => save);
});

describe('ProductSheet: novo', () => {
  it('pede nome e, para venda, o preço', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Novo produto' })).toBeTruthy();
    send();
    expect(alert()).toBe('Dê um nome ao produto');
    type('Nome', 'Pomada');
    expect(alert()).toBeUndefined();
    send();
    expect(alert()).toBe('Informe o preço de venda');
    type('Preço de venda', '3000');
    expect(alert()).toBeUndefined();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('cadastra um produto de venda', async () => {
    const onOpenChange = show();
    type('Nome', ' Pomada ');
    type('Preço de venda', '3000');
    type('Estoque mínimo', '4');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, body: { name: 'Pomada', unit: 'un', minQuantity: 4, kind: 'VENDA', salePriceCents: 3000 } });
    expect(toast.success).toHaveBeenCalledWith('Produto cadastrado ✨');
  });

  it('insumo não tem preço; unidade em branco volta a "un"; mínimo negativo vira 0', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Insumo (uso interno)' }));
    expect(screen.queryByLabelText('Preço de venda')).toBeNull();
    type('Nome', 'Shampoo');
    type('Unidade', '   ');
    type('Estoque mínimo', '-5');
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, body: { name: 'Shampoo', unit: 'un', minQuantity: 0, kind: 'INSUMO', salePriceCents: null } });
  });

  it('erro da API vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Já existe um produto com esse nome']));
    const onOpenChange = show();
    type('Nome', 'Pomada');
    type('Preço de venda', '100');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um produto com esse nome'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('ProductSheet: editar', () => {
  it('vem preenchido, sem escolha de tipo, e salva pelo id', async () => {
    const onOpenChange = show(venda);
    expect(screen.getByRole('dialog', { name: 'Editar produto' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Insumo (uso interno)' })).toBeNull();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Pomada');
    expect((screen.getByLabelText('Preço de venda') as HTMLInputElement).value).toBe('30,00');
    expect((screen.getByLabelText('Estoque mínimo') as HTMLInputElement).value).toBe('2');
    type('Preço de venda', '3500');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 'p1', body: { name: 'Pomada', unit: 'un', minQuantity: 2, salePriceCents: 3500 } });
    expect(toast.success).toHaveBeenCalledWith('Alterações salvas');
  });

  it('insumo editado não leva preço', async () => {
    show(insumo);
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toEqual({ name: 'Shampoo', unit: 'ml', minQuantity: 0, salePriceCents: undefined });
  });

  it('desativar e reativar', async () => {
    const a = show(venda);
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Produto desativado'));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 'p1', body: { active: false } });
    expect(a).toHaveBeenCalledWith(false);
  });

  it('reativar um produto desligado; erro vira aviso', async () => {
    save.mutateAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(400, 'x', ['Não deu']));
    show(insumo);
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Produto reativado'));
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não deu'));
  });
});
