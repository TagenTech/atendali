import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const retention = vi.hoisted(() => ({ useServiceSupplies: vi.fn(), useProducts: vi.fn(), useSetSupplies: vi.fn() }));
vi.mock('@/lib/queries/retention', () => retention);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { SuppliesEditor } from './supplies-editor';

const products = [
  { id: 'i1', name: 'Shampoo', unit: 'ml', kind: 'INSUMO', active: true },
  { id: 'i2', name: 'Tinta', unit: 'g', kind: 'INSUMO', active: true },
  { id: 'i3', name: 'Velho', unit: 'g', kind: 'INSUMO', active: false },
  { id: 'v1', name: 'Pomada', unit: 'un', kind: 'VENDA', active: true },
];
let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(supplies: { productId: string; quantity: number }[] = []) {
  retention.useServiceSupplies.mockReturnValue({ data: supplies });
  render(<SuppliesEditor serviceId="s1" />);
}
const selects = () => screen.queryAllByLabelText('Insumo') as HTMLSelectElement[];
const qtys = () => screen.queryAllByLabelText('Quantidade') as HTMLInputElement[];
const add = () => fireEvent.click(screen.getByRole('button', { name: /Adicionar insumo/ }));

beforeEach(() => {
  vi.clearAllMocks();
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  retention.useSetSupplies.mockImplementation(() => save);
  retention.useProducts.mockReturnValue({ data: products });
});

describe('SuppliesEditor', () => {
  it('sem insumos cadastrados nem ficha, orienta a cadastrar em Estoque', () => {
    retention.useProducts.mockReturnValue({ data: [products[3]] });
    show();
    expect(screen.getByText(/Cadastre insumos em Estoque/)).toBeTruthy();
  });

  it('sem dados ainda (carregando) também não quebra', () => {
    retention.useProducts.mockReturnValue({ data: undefined });
    retention.useServiceSupplies.mockReturnValue({ data: undefined });
    render(<SuppliesEditor serviceId="s1" />);
    expect(screen.getByText(/Cadastre insumos em Estoque/)).toBeTruthy();
  });

  it('mostra a ficha atual e só oferece insumos ativos e ainda não usados', () => {
    show([{ productId: 'i1', quantity: 20 }]);
    expect(selects()).toHaveLength(1);
    expect(selects()[0].value).toBe('i1');
    expect(qtys()[0].value).toBe('20');
    const options = within(selects()[0]).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Escolha…', 'Shampoo (ml)', 'Tinta (g)']);
    expect(screen.queryByRole('button', { name: 'Salvar ficha' })).toBeNull();
  });

  it('adicionar insumo abre uma linha em branco, outra não repete o já usado, e trava quando acabam', () => {
    show([{ productId: 'i1', quantity: 20 }]);
    add();
    expect(selects()).toHaveLength(2);
    expect(within(selects()[1]).getAllByRole('option').map((o) => o.textContent)).toEqual(['Escolha…', 'Tinta (g)']);
    fireEvent.change(selects()[1], { target: { value: 'i2' } });
    expect((screen.getByRole('button', { name: /Adicionar insumo/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Salvar ficha' })).toBeTruthy();
  });

  it('salva a ficha com quantidades inteiras e ignora linha sem insumo', async () => {
    show([{ productId: 'i1', quantity: 20 }]);
    fireEvent.change(qtys()[0], { target: { value: '25.7' } });
    add();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ficha técnica salva'));
    expect(save.mutateAsync).toHaveBeenCalledWith({ serviceId: 's1', supplies: [{ productId: 'i1', quantity: 25 }] });
    // depois de salvar, volta a mostrar o que veio do servidor e some o botão
    expect(screen.queryByRole('button', { name: 'Salvar ficha' })).toBeNull();
  });

  it('recusa quantidade zero ou vazia', async () => {
    show([{ productId: 'i1', quantity: 20 }]);
    fireEvent.change(qtys()[0], { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));
    expect(toast.error).toHaveBeenCalledWith('Informe a quantidade de cada insumo');
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('remover uma linha deixa a ficha para salvar', async () => {
    show([{ productId: 'i1', quantity: 20 }, { productId: 'i2', quantity: 5 }]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover insumo' })[0]);
    expect(selects()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalledWith({ serviceId: 's1', supplies: [{ productId: 'i2', quantity: 5 }] }));
  });

  it('erro da API vira aviso e mantém a edição', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(400, 'x', ['Insumo desativado']));
    show([{ productId: 'i1', quantity: 20 }]);
    fireEvent.change(qtys()[0], { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Insumo desativado'));
    expect(qtys()[0].value).toBe('30');
  });
});
