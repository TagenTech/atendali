import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useAdjustPoints: vi.fn(), useClientPackages: vi.fn(), useLoyalty: vi.fn(), useMemberships: vi.fn() }));
vi.mock('@/lib/queries/retention', () => q);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { ClientRetention } from './client-retention';

let adjust: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
const pkg = (over: Record<string, unknown> = {}) => ({ id: 'p1', planName: 'Pacote 5', status: 'ATIVO', sessionsLeft: 3, sessionsTotal: 5, expiresAt: '2026-12-31', ...over });
const enableLoyalty = () => {
  orgState.features = ['PACOTES', 'ASSINATURAS', 'FIDELIDADE'];
  orgState.org = { ...orgState.org, loyalty: { enabled: true, redeemPoints: 100, redeemValueCents: 500 } };
};
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  adjust = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  q.useAdjustPoints.mockImplementation(() => adjust);
  q.useClientPackages.mockReturnValue({ data: [] });
  q.useMemberships.mockReturnValue({ data: [] });
  q.useLoyalty.mockReturnValue({ data: undefined });
});

describe('ClientRetention: o que aparece', () => {
  it('sem módulos ligados não mostra nada e não consulta nada', () => {
    const { container } = render(<ClientRetention clientId="c1" />);
    expect(container.innerHTML).toBe('');
    expect(q.useClientPackages).toHaveBeenCalledWith({ clientId: 'c1', enabled: false });
    expect(q.useMemberships).toHaveBeenCalledWith({ clientId: 'c1', enabled: false });
    expect(q.useLoyalty).toHaveBeenCalledWith('c1', false);
  });

  it('pontos exigem o módulo e o programa ligado', () => {
    orgState.features = ['FIDELIDADE'];
    render(<ClientRetention clientId="c1" />);
    expect(q.useLoyalty).toHaveBeenCalledWith('c1', false);
  });

  it('pacotes: mostra os ativos ou com sessões; se nenhum, os dois primeiros', () => {
    orgState.features = ['PACOTES'];
    q.useClientPackages.mockReturnValue({ data: [pkg(), pkg({ id: 'p2', planName: 'Antigo', status: 'EXPIRADO', sessionsLeft: 0, expiresAt: null })] });
    const a = render(<ClientRetention clientId="c1" />);
    expect(screen.getByText('Pacote 5')).toBeTruthy();
    expect(screen.getByText(/3 de 5 sessões · até/)).toBeTruthy();
    expect(screen.queryByText('Antigo')).toBeNull();
    a.unmount();
    q.useClientPackages.mockReturnValue({ data: [pkg({ id: 'p2', planName: 'Antigo', status: 'EXPIRADO', sessionsLeft: 0, expiresAt: null }), pkg({ id: 'p3', planName: 'Outro', status: 'ESGOTADO', sessionsLeft: 0 }), pkg({ id: 'p4', planName: 'Terceiro', status: 'ESGOTADO', sessionsLeft: 0 })] });
    render(<ClientRetention clientId="c1" />);
    expect(screen.getByText('Antigo')).toBeTruthy();
    expect(screen.getByText('Outro')).toBeTruthy();
    expect(screen.queryByText('Terceiro')).toBeNull();
    expect(screen.getByText(/0 de 5 sessões$/)).toBeTruthy();
  });

  it('clube: mensalidade paga e sessões no mês, ou ilimitado e sem pagamento', () => {
    orgState.features = ['ASSINATURAS'];
    q.useMemberships.mockReturnValue({
      data: [
        { id: 'm1', planName: 'Clube Ouro', state: 'EM_DIA', paidThrough: '2026-11-30', sessionsPerMonth: 4, sessionsUsedInCycle: 1 },
        { id: 'm2', planName: 'Clube Livre', state: 'VENCIDA', paidThrough: null, sessionsPerMonth: null, sessionsUsedInCycle: 0 },
      ],
    });
    render(<ClientRetention clientId="c1" />);
    expect(screen.getByText(/Pago até .* · 1\/4 sessões no mês/)).toBeTruthy();
    expect(screen.getByText('Sem mensalidade paga · ilimitado')).toBeTruthy();
    expect(screen.getByText(/Mensalidade vencida/)).toBeTruthy();
  });

  it('pontos: saldo e as últimas 4 movimentações com sinal', () => {
    enableLoyalty();
    const entries = [1, 2, 3, 4, 5].map((i) => ({ id: `e${i}`, reason: `Motivo ${i}`, points: i === 2 ? -50 : 10 * i }));
    q.useLoyalty.mockReturnValue({ data: { balance: 140, entries } });
    render(<ClientRetention clientId="c1" />);
    expect(screen.getByText('140')).toBeTruthy();
    expect(screen.getByText('+10')).toBeTruthy();
    expect(screen.getByText('-50')).toBeTruthy();
    expect(screen.queryByText('Motivo 5')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajustar pontos' })).toBeNull();
  });

  it('pontos sem movimentação mostram só o saldo', () => {
    enableLoyalty();
    q.useLoyalty.mockReturnValue({ data: { balance: 0, entries: [] } });
    render(<ClientRetention clientId="c1" />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('ClientRetention: ajustar pontos', () => {
  beforeEach(() => {
    enableLoyalty();
    orgState.permissions = ['clients.manage'];
    q.useLoyalty.mockReturnValue({ data: { balance: 100, entries: [] } });
  });
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Ajustar pontos' }));

  it('exige pontos e motivo, e os erros somem ao digitar', () => {
    render(<ClientRetention clientId="c1" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Informe os pontos (use − para tirar)', 'Conte o motivo']);
    type('Pontos (+ ou −)', '10');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    type('Motivo', 'x');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(adjust.mutateAsync).not.toHaveBeenCalled();
  });

  it('ajusta, avisa e fecha o formulário', async () => {
    render(<ClientRetention clientId="c1" />);
    open();
    type('Pontos (+ ou −)', '-30.9');
    type('Motivo', ' Correção ');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pontos ajustados'));
    expect(adjust.mutateAsync).toHaveBeenCalledWith({ clientId: 'c1', points: -30, note: 'Correção' });
    expect(screen.getByRole('button', { name: 'Ajustar pontos' })).toBeTruthy();
    open();
    expect((screen.getByLabelText('Pontos (+ ou −)') as HTMLInputElement).value).toBe('');
  });

  it('cancelar fecha; erro da API vira aviso e mantém o formulário', async () => {
    adjust.mutateAsync.mockRejectedValue(new ApiError(400, 'x', ['Saldo ficaria negativo']));
    render(<ClientRetention clientId="c1" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Motivo')).toBeNull();
    open();
    type('Pontos (+ ou −)', '-500');
    type('Motivo', 'x');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Saldo ficaria negativo'));
    expect(screen.getByLabelText('Motivo')).toBeTruthy();
  });
});
