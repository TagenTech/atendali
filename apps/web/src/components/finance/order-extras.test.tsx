import type { OrderDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useLoyalty: vi.fn(), useRequestReview: vi.fn(), useClient: vi.fn() }));
vi.mock('@/lib/queries/retention', () => ({ useLoyalty: q.useLoyalty, useRequestReview: q.useRequestReview }));
vi.mock('@/lib/queries/agenda', () => ({ useClient: q.useClient }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { LoyaltyRedeem, ReviewRequest } from './order-extras';

const order = (over: Record<string, unknown> = {}) => ({ id: 'o1', clientId: 'cl1', status: 'ABERTA', loyalty: { redeemedPoints: 0, discountCents: 0 }, ...over }) as unknown as OrderDto;
const enableLoyalty = () => (orgState.org = { ...orgState.org, loyalty: { enabled: true, redeemPoints: 100, redeemValueCents: 500 } });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
});

describe('LoyaltyRedeem', () => {
  it('não aparece com o programa desligado, sem cliente, sem dados ou sem pontos', () => {
    q.useLoyalty.mockReturnValue({ data: { balance: 500 } });
    const a = render(<LoyaltyRedeem order={order()} busy={false} onRedeem={vi.fn()} />);
    expect(a.container.innerHTML).toBe('');
    enableLoyalty();
    a.unmount();
    const b = render(<LoyaltyRedeem order={order({ clientId: null })} busy={false} onRedeem={vi.fn()} />);
    expect(b.container.innerHTML).toBe('');
    b.unmount();
    q.useLoyalty.mockReturnValue({ data: undefined });
    const c = render(<LoyaltyRedeem order={order()} busy={false} onRedeem={vi.fn()} />);
    expect(c.container.innerHTML).toBe('');
    c.unmount();
    q.useLoyalty.mockReturnValue({ data: { balance: 0 } });
    const d = render(<LoyaltyRedeem order={order()} busy={false} onRedeem={vi.fn()} />);
    expect(d.container.innerHTML).toBe('');
  });

  it('mostra o saldo e deixa resgatar de 100 em 100 pontos', () => {
    enableLoyalty();
    q.useLoyalty.mockReturnValue({ data: { balance: 250 } });
    const onRedeem = vi.fn().mockResolvedValue(true);
    render(<LoyaltyRedeem order={order()} busy={false} onRedeem={onRedeem} />);
    expect(screen.getByText('250 pontos')).toBeTruthy();
    expect(screen.getByText('Nenhum resgate')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Resgatar menos' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar mais' }));
    expect(onRedeem).toHaveBeenCalledWith(100);
  });

  it('com resgate feito: soma o já usado ao saldo, mostra o desconto e deixa subir ou descer', () => {
    enableLoyalty();
    q.useLoyalty.mockReturnValue({ data: { balance: 100 } });
    const onRedeem = vi.fn().mockResolvedValue(true);
    render(<LoyaltyRedeem order={order({ loyalty: { redeemedPoints: 100, discountCents: 500 } })} busy={false} onRedeem={onRedeem} />);
    // 100 de saldo + 100 já resgatados = 200
    expect(screen.getByText('200 pontos')).toBeTruthy();
    expect(screen.getByText(/100 pontos = − .*5,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar menos' }));
    expect(onRedeem).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar mais' }));
    expect(onRedeem).toHaveBeenLastCalledWith(200);
  });

  it('no máximo ou ocupado, os botões travam', () => {
    enableLoyalty();
    q.useLoyalty.mockReturnValue({ data: { balance: 0 } });
    const a = render(<LoyaltyRedeem order={order({ loyalty: { redeemedPoints: 100, discountCents: 500 } })} busy={false} onRedeem={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Resgatar mais' }) as HTMLButtonElement).disabled).toBe(true);
    a.unmount();
    q.useLoyalty.mockReturnValue({ data: { balance: 500 } });
    render(<LoyaltyRedeem order={order()} busy onRedeem={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Resgatar mais' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ReviewRequest', () => {
  const mutate = (impl: () => Promise<unknown>) => q.useRequestReview.mockReturnValue({ mutateAsync: vi.fn(impl), isPending: false });

  beforeEach(() => {
    q.useClient.mockReturnValue({ data: { phone: '11999998888' } });
  });

  it('só aparece em comanda fechada de pessoa cadastrada', () => {
    mutate(async () => ({}));
    const a = render(<ReviewRequest order={order({ status: 'ABERTA' })} />);
    expect(a.container.innerHTML).toBe('');
    a.unmount();
    const b = render(<ReviewRequest order={order({ status: 'FECHADA', clientId: null })} />);
    expect(b.container.innerHTML).toBe('');
  });

  it('pede o link, mostra a mensagem, copia e abre o WhatsApp', async () => {
    mutate(async () => ({ token: 't', path: '/avaliar/t', message: 'Conta pra gente como foi!\nhttps://x/avaliar/t' }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ReviewRequest order={order({ status: 'FECHADA' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir avaliação' }));
    expect(await screen.findByText(/Conta pra gente como foi!/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Mensagem copiada'));
    expect(writeText).toHaveBeenCalledWith('Conta pra gente como foi!\nhttps://x/avaliar/t');
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(wa.getAttribute('target')).toBe('_blank');
  });

  it('sem telefone não oferece WhatsApp; se não der para copiar, avisa mesmo assim', async () => {
    q.useClient.mockReturnValue({ data: undefined });
    mutate(async () => ({ token: 't', path: '/p', message: 'oi' }));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('negado')) }, configurable: true });
    render(<ReviewRequest order={order({ status: 'FECHADA' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir avaliação' }));
    await screen.findByText('oi');
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('erro da API vira aviso e o botão continua lá', async () => {
    mutate(async () => {
      throw new ApiError(409, 'x', ['Já existe um pedido']);
    });
    render(<ReviewRequest order={order({ status: 'FECHADA' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir avaliação' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um pedido'));
    expect(screen.getByRole('button', { name: 'Pedir avaliação' })).toBeTruthy();
  });
});
