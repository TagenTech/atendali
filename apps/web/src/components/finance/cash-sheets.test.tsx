import type { CashSessionDto } from '@skedulei/contracts';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const fin = vi.hoisted(() => ({ cashMovement: vi.fn(), closeCash: vi.fn() }));
vi.mock('@/lib/api/finance', () => fin);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { renderWithQuery } from '@/test/render';
import { CloseCashSheet, MovementSheet } from './cash-sheets';

const cash = (over: Partial<CashSessionDto> = {}): CashSessionDto => ({
  id: 'c1',
  status: 'ABERTO',
  openedAt: '2026-10-28T10:00:00Z',
  openedByName: 'Ana',
  openingCents: 10000,
  closedAt: null,
  closedByName: null,
  countedCents: null,
  movements: [],
  expected: { byMethod: { DINHEIRO: 5000, PIX: 2500 } as CashSessionDto['expected']['byMethod'], drawerCents: 15000 },
  differenceCents: null,
  openOrders: 0,
  ...over,
});

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('MovementSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sangria: recusa valor vazio, mostra o erro no campo e não chama a API', async () => {
    const onOpenChange = vi.fn();
    renderWithQuery(<MovementSheet kind="SANGRIA" onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Sangria' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Informe um valor maior que zero');
    expect(fin.cashMovement).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('sangria: grava com a máscara de centavos e o motivo, e fecha', async () => {
    fin.cashMovement.mockResolvedValue(cash());
    const onOpenChange = vi.fn();
    renderWithQuery(<MovementSheet kind="SANGRIA" onOpenChange={onOpenChange} />);
    type('Valor', '1050');
    expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe('10,50');
    type(/Motivo/, '  depósito  ');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fin.cashMovement).toHaveBeenCalledWith('o1', { kind: 'SANGRIA', amountCents: 1050, note: 'depósito' });
    expect(toast.success).toHaveBeenCalledWith('Sangria registrada');
  });

  it('suprimento: textos próprios, motivo vazio vai como null, e apagar o valor limpa o erro', async () => {
    fin.cashMovement.mockResolvedValue(cash());
    renderWithQuery(<MovementSheet kind="SUPRIMENTO" onOpenChange={vi.fn()} />);
    expect(screen.getByText('Dinheiro que entra na gaveta (troco).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await screen.findByRole('alert');
    type('Valor', '5');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suprimento registrado'));
    expect(fin.cashMovement).toHaveBeenCalledWith('o1', { kind: 'SUPRIMENTO', amountCents: 5, note: null });
  });

  it('se a API recusar, avisa e deixa o painel aberto', async () => {
    fin.cashMovement.mockRejectedValue(new ApiError(409, 'Caixa fechado', ['Abra o caixa primeiro']));
    const onOpenChange = vi.fn();
    renderWithQuery(<MovementSheet kind="SANGRIA" onOpenChange={onOpenChange} />);
    type('Valor', '100');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Abra o caixa primeiro'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('CloseCashSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra o que entrou por forma, o troco inicial e o esperado na gaveta', () => {
    renderWithQuery(<CloseCashSheet cash={cash()} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Dinheiro')).toBeTruthy();
    expect(screen.getByText('PIX')).toBeTruthy();
    expect(screen.getByText('Troco inicial')).toBeTruthy();
    expect(screen.getByText('Esperado na gaveta')).toBeTruthy();
    expect(screen.queryByText('Sangrias e suprimentos')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('soma suprimentos e subtrai sangrias', () => {
    const movements = [
      { id: 'm1', kind: 'SUPRIMENTO' as const, amountCents: 3000, note: null, createdAt: '' },
      { id: 'm2', kind: 'SANGRIA' as const, amountCents: 1000, note: null, createdAt: '' },
    ];
    renderWithQuery(<CloseCashSheet cash={cash({ movements })} onOpenChange={vi.fn()} />);
    const row = screen.getByText('Sangrias e suprimentos').closest('tr')!;
    expect(row.textContent).toMatch(/20,00/);
  });

  it('compara o contado com o esperado: certinho, sobrando e faltando', () => {
    renderWithQuery(<CloseCashSheet cash={cash()} onOpenChange={vi.fn()} />);
    type('Dinheiro contado na gaveta', '15000');
    expect(screen.getByRole('status').textContent).toBe('Bateu certinho ✓');
    type('Dinheiro contado na gaveta', '16000');
    expect(screen.getByRole('status').textContent).toMatch(/Sobrando .*10,00/);
    type('Dinheiro contado na gaveta', '14000');
    expect(screen.getByRole('status').textContent).toMatch(/Faltando .*10,00/);
  });

  it('exige o valor contado (zero vale) antes de fechar', async () => {
    renderWithQuery(<CloseCashSheet cash={cash()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar caixa' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o dinheiro contado (pode ser 0)');
    expect(fin.closeCash).not.toHaveBeenCalled();
  });

  it('fecha o caixa com o valor e a observação', async () => {
    fin.closeCash.mockResolvedValue(cash({ status: 'FECHADO' }));
    const onOpenChange = vi.fn();
    renderWithQuery(<CloseCashSheet cash={cash()} onOpenChange={onOpenChange} />);
    type('Dinheiro contado na gaveta', '15000');
    type(/Observação/, ' tudo certo ');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar caixa' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fin.closeCash).toHaveBeenCalledWith('o1', { countedCents: 15000, notes: 'tudo certo' });
    expect(toast.success).toHaveBeenCalledWith('Caixa fechado ✓');
  });

  it('contar zero é válido; observação vazia vai como null; erro da API aparece', async () => {
    fin.closeCash.mockRejectedValue(new ApiError(409, 'Comanda aberta', ['Feche as comandas abertas']));
    renderWithQuery(<CloseCashSheet cash={cash()} onOpenChange={vi.fn()} />);
    // digita algo e apaga: o campo vira 0, que é um valor válido
    type('Dinheiro contado na gaveta', '5');
    type('Dinheiro contado na gaveta', '');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar caixa' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Feche as comandas abertas'));
    expect(fin.closeCash).toHaveBeenCalledWith('o1', { countedCents: 0, notes: null });
  });
});
