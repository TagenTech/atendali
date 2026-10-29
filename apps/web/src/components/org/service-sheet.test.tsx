import type { ServiceDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
vi.mock('@/components/org/supplies-editor', () => ({ SuppliesEditor: ({ serviceId }: { serviceId: string }) => <div data-testid="supplies">{serviceId}</div> }));
const org = vi.hoisted(() => ({ useSaveService: vi.fn() }));
vi.mock('@/lib/queries/org', () => org);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { ServiceSheet } from './service-sheet';

const service = {
  id: 's1',
  name: 'Corte',
  category: 'Cabelo',
  durationMinutes: 45,
  priceCents: 5000,
  description: 'Corte feminino',
  onlineBooking: false,
  commissionBps: 3000,
  active: true,
} as ServiceDto;
let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(s: ServiceDto | null = null) {
  const onOpenChange = vi.fn();
  render(<ServiceSheet open onOpenChange={onOpenChange} service={s} categories={['Cabelo', 'Unhas']} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  org.useSaveService.mockImplementation(() => save);
});

describe('ServiceSheet', () => {
  it('novo: título e mensagens seguem o vocabulário; exige o nome', () => {
    orgState.vocab = { ...orgState.vocab, service: 'Procedimento' };
    show();
    expect(screen.getByRole('dialog', { name: 'Novo procedimento' })).toBeTruthy();
    send();
    expect(screen.getByRole('alert').textContent).toBe('Dê um nome para o procedimento');
    type('Nome', 'A');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cria com os padrões: 60 min, gratuito, agendamento online ligado', async () => {
    const onOpenChange = show();
    type('Nome', ' Avaliação ');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      id: undefined,
      body: { name: 'Avaliação', category: null, durationMinutes: 60, priceCents: 0, description: null, onlineBooking: true, commissionBps: null },
    });
    expect(toast.success).toHaveBeenCalledWith('Serviço criado ✨');
  });

  it('cria com tudo: duração por atalho, preço, comissão e sem agendamento online', async () => {
    show();
    type('Nome', 'Escova');
    type('Categoria', ' Cabelo ');
    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    type('Preço', '7000');
    type('Descrição (opcional)', ' Com finalização ');
    type('Comissão deste item', '12.5');
    fireEvent.click(screen.getByRole('switch'));
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toEqual({
      name: 'Escova',
      category: 'Cabelo',
      durationMinutes: 30,
      priceCents: 7000,
      description: 'Com finalização',
      onlineBooking: false,
      commissionBps: 1250,
    });
  });

  it('a duração em minutos aceita digitar, com mínimo de 5 e máximo de 720', () => {
    show();
    const input = () => screen.getByLabelText('Duração em minutos') as HTMLInputElement;
    type('Duração em minutos', '50');
    expect(input().value).toBe('50');
    type('Duração em minutos', '1');
    expect(input().value).toBe('5');
    type('Duração em minutos', '9999');
    expect(input().value).toBe('720');
    type('Duração em minutos', '');
    expect(input().value).toBe('5');
  });

  it('oferece as categorias já usadas', () => {
    show();
    expect(Array.from(document.querySelectorAll('#svc-categories option')).map((o) => o.getAttribute('value'))).toEqual(['Cabelo', 'Unhas']);
  });

  it('editar: vem preenchido, salva pelo id e mostra a ficha técnica só com o estoque ligado', async () => {
    const a = show(service);
    expect(screen.getByRole('dialog', { name: 'Editar serviço' })).toBeTruthy();
    expect((screen.getByLabelText('Preço') as HTMLInputElement).value).toBe('50,00');
    expect((screen.getByLabelText('Comissão deste item') as HTMLInputElement).value).toBe('30');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('supplies')).toBeNull();
    send();
    await waitFor(() => expect(a).toHaveBeenCalledWith(false));
    expect(save.mutateAsync.mock.calls[0][0].id).toBe('s1');
    expect(toast.success).toHaveBeenCalledWith('Alterações salvas');
  });

  it('com o módulo de estoque a ficha técnica aparece na edição, mas não na criação', () => {
    orgState.features = ['ESTOQUE'];
    const { unmount } = render(<ServiceSheet open onOpenChange={vi.fn()} service={service} categories={[]} />);
    expect(screen.getByTestId('supplies').textContent).toBe('s1');
    unmount();
    render(<ServiceSheet open onOpenChange={vi.fn()} service={null} categories={[]} />);
    expect(screen.queryByTestId('supplies')).toBeNull();
  });

  it('desativar e reativar', async () => {
    save.mutateAsync.mockResolvedValue({});
    const a = show(service);
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Serviço desativado'));
    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 's1', body: { active: false } });
    expect(a).toHaveBeenCalledWith(false);
  });

  it('reativar um serviço desligado; erros viram aviso', async () => {
    save.mutateAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(409, 'x', ['Serviço em uso']));
    show({ ...service, active: false });
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Serviço reativado'));
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Serviço em uso'));
  });

  it('erro ao salvar vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Nome repetido']));
    const onOpenChange = show();
    type('Nome', 'Corte');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nome repetido'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
