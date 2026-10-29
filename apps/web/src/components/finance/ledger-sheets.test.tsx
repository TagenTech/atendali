import type { PayableDto, ReceivableDto } from '@skedulei/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { timezone: 'America/Sao_Paulo' } }) }));
const ledger = vi.hoisted(() => ({
  financeCategories: vi.fn(),
  financeAccounts: vi.fn(),
  createPayable: vi.fn(),
  updatePayable: vi.fn(),
  settlePayable: vi.fn(),
  settleReceivable: vi.fn(),
  createReceivable: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock('@/lib/api/ledger', () => ledger);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { renderWithQuery } from '@/test/render';
import { CategoriesSheet, PayableFormSheet, ReceivableFormSheet, SettleSheet } from './ledger-sheets';

const categories = [
  { id: 'd1', name: 'Aluguel', type: 'DESPESA', active: true },
  { id: 'd2', name: 'Antiga', type: 'DESPESA', active: false },
  { id: 'r1', name: 'Vendas', type: 'RECEITA', active: true },
];
const accounts = [
  { id: 'a1', name: 'Banco', active: true },
  { id: 'a2', name: 'Cofre velho', active: false },
];
const payable: PayableDto = {
  id: 'p1',
  description: 'Luz',
  categoryId: 'd2',
  categoryName: 'Antiga',
  amountCents: 20000,
  dueDate: '2026-11-05',
  paidDate: null,
  paidMethod: null,
  accountId: null,
  accountName: null,
  recurrenceId: null,
  installment: null,
  status: 'PENDENTE',
  notes: 'conta de outubro',
} as PayableDto;
const receivable = { id: 'v1', description: 'Aluguel de cadeira', amountCents: 80000 } as ReceivableDto;

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  ledger.financeCategories.mockResolvedValue(categories);
  ledger.financeAccounts.mockResolvedValue(accounts);
});

describe('PayableFormSheet', () => {
  it('nova conta: pede descrição e valor, cada erro no seu campo', async () => {
    renderWithQuery(<PayableFormSheet payable={null} onOpenChange={vi.fn()} />);
    click('Criar conta');
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(['Descreva a conta', 'Informe o valor']);
    expect(ledger.createPayable).not.toHaveBeenCalled();
    type('Descrição', 'Aluguel');
    expect(screen.queryByText('Descreva a conta')).toBeNull();
    expect(screen.getByText('Informe o valor')).toBeTruthy();
  });

  it('cria uma conta simples (só categorias de despesa ativas aparecem)', async () => {
    ledger.createPayable.mockResolvedValue([]);
    const onOpenChange = vi.fn();
    renderWithQuery(<PayableFormSheet payable={null} onOpenChange={onOpenChange} />);
    await screen.findByRole('option', { name: 'Aluguel' });
    expect(screen.queryByRole('option', { name: 'Antiga' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Vendas' })).toBeNull();
    type('Descrição', ' Aluguel ');
    type('Categoria', 'd1');
    type('Valor', '150000');
    type('Vencimento', '2026-11-10');
    type('Observação', 'sala 2');
    click('Criar conta');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(ledger.createPayable).toHaveBeenCalledWith('o1', {
      description: 'Aluguel',
      categoryId: 'd1',
      amountCents: 150000,
      dueDate: '2026-11-10',
      monthlyCount: null,
      notes: 'sala 2',
    });
    expect(toast.success).toHaveBeenCalledWith('Conta criada');
  });

  it('repetição mensal: valida de 2 a 36 meses e cria as parcelas', async () => {
    ledger.createPayable.mockResolvedValue([]);
    renderWithQuery(<PayableFormSheet payable={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText('Quantos meses')).toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    type('Descrição', 'Internet');
    type('Valor', '9900');
    type('Vencimento', '2026-11-10');
    type('Quantos meses', '1');
    click('Criar conta');
    expect((await screen.findByRole('alert')).textContent).toBe('Use de 2 a 36 meses');
    type('Quantos meses', '3x');
    expect((screen.getByLabelText('Quantos meses') as HTMLInputElement).value).toBe('3');
    type('Quantos meses', '3');
    click('Criar conta');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('3 contas criadas'));
    expect(ledger.createPayable).toHaveBeenCalledWith('o1', expect.objectContaining({ monthlyCount: 3, notes: null, categoryId: null }));
  });

  it('editar: vem preenchida, não oferece repetição e mantém a categoria desligada já escolhida', async () => {
    ledger.updatePayable.mockResolvedValue(payable);
    const onOpenChange = vi.fn();
    renderWithQuery(<PayableFormSheet payable={payable} onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Editar conta' })).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe('Luz');
    expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe('200,00');
    await screen.findByRole('option', { name: 'Antiga' });
    type('Valor', '25000');
    click('Salvar');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(ledger.updatePayable).toHaveBeenCalledWith('o1', {
      id: 'p1',
      description: 'Luz',
      categoryId: 'd2',
      amountCents: 25000,
      dueDate: '2026-11-05',
      notes: 'conta de outubro',
    });
    expect(toast.success).toHaveBeenCalledWith('Conta atualizada');
  });

  it('erro da API vira aviso e o painel fica aberto', async () => {
    ledger.createPayable.mockRejectedValue(new ApiError(400, 'x', ['Vencimento inválido']));
    const onOpenChange = vi.fn();
    renderWithQuery(<PayableFormSheet payable={null} onOpenChange={onOpenChange} />);
    type('Descrição', 'X');
    type('Valor', '100');
    click('Criar conta');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Vencimento inválido'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('SettleSheet', () => {
  it('pagar: pede forma de pagamento e conta (só as ativas) e dá baixa', async () => {
    ledger.settlePayable.mockResolvedValue(payable);
    const onOpenChange = vi.fn();
    renderWithQuery(<SettleSheet item={{ kind: 'pay', payable }} onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Marcar como paga' })).toBeTruthy();
    expect(screen.getByText(/Luz · .*200,00/)).toBeTruthy();
    await screen.findByRole('option', { name: 'Banco' });
    expect(screen.queryByRole('option', { name: 'Cofre velho' })).toBeNull();
    type('Data do pagamento', '2026-10-20');
    type('Forma de pagamento', 'DINHEIRO');
    type('Conta', 'a1');
    click('Confirmar pagamento');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(ledger.settlePayable).toHaveBeenCalledWith('o1', { id: 'p1', paidDate: '2026-10-20', method: 'DINHEIRO', accountId: 'a1' });
    expect(toast.success).toHaveBeenCalledWith('Conta paga');
  });

  it('pagar sem escolher nada usa Pix e a conta principal', async () => {
    ledger.settlePayable.mockResolvedValue(payable);
    renderWithQuery(<SettleSheet item={{ kind: 'pay', payable }} onOpenChange={vi.fn()} />);
    type('Data do pagamento', '2026-10-20');
    click('Confirmar pagamento');
    await waitFor(() => expect(ledger.settlePayable).toHaveBeenCalled());
    expect(ledger.settlePayable).toHaveBeenCalledWith('o1', { id: 'p1', paidDate: '2026-10-20', method: 'PIX', accountId: null });
  });

  it('receber: não pergunta a forma e registra o recebimento', async () => {
    ledger.settleReceivable.mockResolvedValue(receivable);
    renderWithQuery(<SettleSheet item={{ kind: 'receive', receivable }} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Dar baixa' })).toBeTruthy();
    expect(screen.queryByLabelText('Forma de pagamento')).toBeNull();
    type('Data do recebimento', '2026-10-21');
    click('Confirmar recebimento');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Recebimento registrado'));
    expect(ledger.settleReceivable).toHaveBeenCalledWith('o1', { id: 'v1', receivedDate: '2026-10-21', accountId: null });
  });

  it('erro da API vira aviso', async () => {
    ledger.settleReceivable.mockRejectedValue(new Error('boom'));
    renderWithQuery(<SettleSheet item={{ kind: 'receive', receivable }} onOpenChange={vi.fn()} />);
    click('Confirmar recebimento');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar'));
  });
});

describe('ReceivableFormSheet', () => {
  it('pede descrição e valor', async () => {
    renderWithQuery(<ReceivableFormSheet onOpenChange={vi.fn()} />);
    click('Lançar receita');
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(['Descreva a receita', 'Informe o valor']);
    type('Descrição', 'a');
    type('Valor', '1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lança a receita com categoria de receita', async () => {
    ledger.createReceivable.mockResolvedValue({});
    const onOpenChange = vi.fn();
    renderWithQuery(<ReceivableFormSheet onOpenChange={onOpenChange} />);
    await screen.findByRole('option', { name: 'Vendas' });
    expect(screen.queryByRole('option', { name: 'Aluguel' })).toBeNull();
    type('Descrição', 'Aluguel de cadeira');
    type('Categoria', 'r1');
    type('Valor', '80000');
    type('Data prevista', '2026-11-01');
    click('Lançar receita');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(ledger.createReceivable).toHaveBeenCalledWith('o1', { description: 'Aluguel de cadeira', categoryId: 'r1', amountCents: 80000, expectedDate: '2026-11-01' });
    expect(toast.success).toHaveBeenCalledWith('Receita lançada');
  });

  it('erro da API vira aviso', async () => {
    ledger.createReceivable.mockRejectedValue(new ApiError(400, 'x', ['Data no passado']));
    renderWithQuery(<ReceivableFormSheet onOpenChange={vi.fn()} />);
    type('Descrição', 'a');
    type('Valor', '100');
    click('Lançar receita');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Data no passado'));
  });
});

describe('CategoriesSheet', () => {
  it('separa despesas e receitas', async () => {
    renderWithQuery(<CategoriesSheet onOpenChange={vi.fn()} />);
    await screen.findByLabelText('Nome da categoria Aluguel');
    const despesas = screen.getByRole('region', { name: 'Despesas' });
    expect(within(despesas).getByLabelText('Nome da categoria Aluguel')).toBeTruthy();
    expect(within(despesas).getByRole('button', { name: 'Ligar Antiga' }).textContent).toBe('Desligada');
    expect(within(screen.getByRole('region', { name: 'Receitas' })).getByLabelText('Nome da categoria Vendas')).toBeTruthy();
  });

  it('renomear ao sair do campo; nome igual ou vazio volta ao que era', async () => {
    ledger.updateCategory.mockResolvedValue({});
    renderWithQuery(<CategoriesSheet onOpenChange={vi.fn()} />);
    const input = (await screen.findByLabelText('Nome da categoria Aluguel')) as HTMLInputElement;
    input.value = '  Aluguel da sala ';
    fireEvent.blur(input);
    await waitFor(() => expect(ledger.updateCategory).toHaveBeenCalledWith('o1', { id: 'd1', name: 'Aluguel da sala' }));
    input.value = '   ';
    fireEvent.blur(input);
    expect(input.value).toBe('Aluguel');
    input.value = 'Aluguel';
    fireEvent.blur(input);
    expect(ledger.updateCategory).toHaveBeenCalledTimes(1);
  });

  it('liga e desliga uma categoria; erro vira aviso', async () => {
    ledger.updateCategory.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(400, 'x', ['Categoria em uso']));
    renderWithQuery(<CategoriesSheet onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ligar Antiga' }));
    await waitFor(() => expect(ledger.updateCategory).toHaveBeenCalledWith('o1', { id: 'd2', active: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Desligar Aluguel' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Categoria em uso'));
  });

  it('inclui uma categoria nova (e exige o nome)', async () => {
    ledger.createCategory.mockResolvedValue({});
    renderWithQuery(<CategoriesSheet onOpenChange={vi.fn()} />);
    await screen.findByLabelText('Nome da categoria Aluguel');
    click('Incluir');
    expect((await screen.findByRole('alert')).textContent).toBe('Dê um nome para a categoria');
    type('Nova categoria', 'Marketing');
    expect(screen.queryByRole('alert')).toBeNull();
    type('Tipo da categoria', 'RECEITA');
    click('Incluir');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Categoria incluída'));
    expect(ledger.createCategory).toHaveBeenCalledWith('o1', { name: 'Marketing', type: 'RECEITA' });
    expect((screen.getByLabelText('Nova categoria') as HTMLInputElement).value).toBe('');
  });
});
