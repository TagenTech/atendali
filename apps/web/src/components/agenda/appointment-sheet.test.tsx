import type { AppointmentDto } from '@skedulei/contracts';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const agenda = vi.hoisted(() => ({ useUpdateAppointment: vi.fn() }));
vi.mock('@/lib/queries/agenda', () => agenda);
const retention = vi.hoisted(() => ({ useCallAppointment: vi.fn() }));
vi.mock('@/lib/queries/retention', () => retention);
const fin = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock('@/lib/api/finance', () => fin);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { renderWithQuery } from '@/test/render';
import { AppointmentSheet } from './appointment-sheet';

const appt = (over: Partial<AppointmentDto> = {}): AppointmentDto =>
  ({
    id: 'ap1',
    clientId: 'c1',
    clientName: 'Maria Souza',
    clientPhone: '11999998888',
    serviceName: 'Corte',
    memberId: 'm1',
    memberName: 'Bia',
    startsAt: '2026-10-28T17:00:00.000Z',
    endsAt: '2026-10-28T18:00:00.000Z',
    status: 'AGENDADO',
    priceCents: 5000,
    notes: null,
    source: 'RECEPCAO',
    orderId: null,
    createdAt: '2026-10-20T12:00:00.000Z',
    ...over,
  }) as AppointmentDto;

const pros = [
  { id: 'm1', name: 'Bia' },
  { id: 'm2', name: 'Caio' },
];
let update: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let call: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(a = appt(), professionals = pros) {
  const onOpenChange = vi.fn();
  renderWithQuery(<AppointmentSheet appointment={a} professionals={professionals} onOpenChange={onOpenChange} />);
  return onOpenChange;
}
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  update = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  call = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  agenda.useUpdateAppointment.mockImplementation(() => update);
  retention.useCallAppointment.mockImplementation(() => call);
});

describe('AppointmentSheet', () => {
  it('cabeçalho com o horário no fuso da unidade e o resumo do atendimento', () => {
    show(appt({ notes: 'prefere a janela', source: 'ONLINE' }));
    expect(screen.getByRole('dialog', { name: 'Maria Souza' })).toBeTruthy();
    expect(screen.getByText('28/10/2026 · 14:00–15:00')).toBeTruthy();
    expect(screen.getByText(/Corte ·/).textContent).toMatch(/50,00/);
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByText('Agendado online')).toBeTruthy();
    expect(screen.getByText('“prefere a janela”')).toBeTruthy();
    expect(screen.getByText(/Marcado em/).textContent).toMatch(/20\/10\/2026/);
  });

  it('serviço sem preço aparece como gratuito e reserva da recepção não leva a etiqueta online', () => {
    show(appt({ priceCents: 0 }));
    expect(screen.getByText('gratuito')).toBeTruthy();
    expect(screen.queryByText('Agendado online')).toBeNull();
  });

  it('oferece só os próximos passos que o fluxo permite', () => {
    show();
    const labels = ['Confirmado', 'Chegou', 'Iniciar atendimento', 'Concluir', 'Faltou', 'Cancelar'];
    for (const l of labels) expect(btn(l)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).toBeNull();
  });

  it('mudar o status grava, avisa e fecha', async () => {
    const onOpenChange = show();
    fireEvent.click(btn('Chegou'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(update.mutateAsync).toHaveBeenCalledWith({ id: 'ap1', body: { status: 'CHEGOU' } });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/ ✓$/));
  });

  it('se a API recusar, mostra o motivo e continua aberto', async () => {
    update.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Horário ocupado']));
    const onOpenChange = show();
    fireEvent.click(btn('Concluir'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Horário ocupado'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('cancelado só pode ser reaberto, e sem remarcar nem abrir comanda', () => {
    orgState.permissions = ['cash.operate'];
    show(appt({ status: 'CANCELADO' }));
    expect(screen.getAllByRole('button').some((b) => b.textContent === 'Reabrir')).toBe(true);
    expect(screen.queryByRole('button', { name: /Remarcar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Abrir comanda/ })).toBeNull();
  });

  it('concluído não remarca', () => {
    show(appt({ status: 'CONCLUIDO' }));
    expect(screen.queryByRole('button', { name: /Remarcar/ })).toBeNull();
  });

  describe('chamar no painel', () => {
    it('só quem vê a agenda toda, e só antes do atendimento', () => {
      show();
      expect(screen.queryByRole('button', { name: /Chamar/ })).toBeNull();
    });

    it('chama o paciente e avisa', async () => {
      orgState.permissions = ['agenda.view_all'];
      show();
      fireEvent.click(btn(/Chamar/));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Chamando no painel de TV 📣'));
      expect(call.mutateAsync).toHaveBeenCalledWith('ap1');
    });

    it('erro da API vira aviso', async () => {
      orgState.permissions = ['agenda.view_all'];
      call.mutateAsync.mockRejectedValue(new Error('x'));
      show();
      fireEvent.click(btn(/Chamar/));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar'));
    });

    it('não aparece depois que o atendimento começou', () => {
      orgState.permissions = ['agenda.view_all'];
      show(appt({ status: 'EM_ATENDIMENTO' }));
      expect(screen.queryByRole('button', { name: /Chamar/ })).toBeNull();
    });
  });

  describe('comanda', () => {
    it('sem permissão de caixa não aparece nada', () => {
      show();
      expect(screen.queryByText(/comanda/i)).toBeNull();
    });

    it('com comanda já aberta, leva até ela', () => {
      orgState.permissions = ['cash.operate'];
      show(appt({ orderId: 'ord9' }));
      expect(screen.getByRole('link', { name: /Ver comanda/ }).getAttribute('href')).toBe('/caixa/ord9');
    });

    it('abre a comanda do atendimento e vai para ela', async () => {
      orgState.permissions = ['cash.operate'];
      fin.createOrder.mockResolvedValue({ id: 'ord1', items: [] });
      show();
      fireEvent.click(btn(/Abrir comanda/));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/caixa/ord1'));
      expect(fin.createOrder).toHaveBeenCalledWith('o1', { appointmentIds: ['ap1'] });
    });

    it('erro ao abrir a comanda vira aviso', async () => {
      orgState.permissions = ['cash.operate'];
      fin.createOrder.mockRejectedValue(new ApiError(409, 'x', ['Abra o caixa primeiro']));
      show();
      fireEvent.click(btn(/Abrir comanda/));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Abra o caixa primeiro'));
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  it('WhatsApp só com telefone; a ficha usa o vocabulário do negócio', () => {
    orgState.vocab = { ...orgState.vocab, client: 'Paciente' };
    show();
    const wa = screen.getByRole('link', { name: /Confirmar no WhatsApp/ });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href')!)).toMatch(/Maria/);
    expect(screen.getByRole('link', { name: /Ficha do paciente/ }).getAttribute('href')).toBe('/clientes/c1');
  });

  it('sem telefone não há WhatsApp', () => {
    show(appt({ clientPhone: null as unknown as string }));
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull();
  });

  describe('remarcar', () => {
    it('abre o formulário com o horário atual e deixa voltar', () => {
      show();
      fireEvent.click(btn(/Remarcar/));
      expect((screen.getByLabelText('Dia') as HTMLInputElement).value).toBe('2026-10-28');
      expect((screen.getByLabelText('Horário') as HTMLInputElement).value).toBe('14:00');
      fireEvent.click(btn('Voltar'));
      expect(screen.queryByLabelText('Dia')).toBeNull();
      expect(btn(/Remarcar/)).toBeTruthy();
    });

    it('grava o novo horário em UTC, com profissional e encaixe', async () => {
      const onOpenChange = show();
      fireEvent.click(btn(/Remarcar/));
      type('Dia', '2026-11-03');
      type('Horário', '09:30');
      type('Profissional', 'm2');
      fireEvent.click(screen.getByRole('switch'));
      fireEvent.click(btn('Salvar novo horário'));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: 'ap1',
        body: { startsAt: '2026-11-03T12:30:00.000Z', memberId: 'm2', allowOutsideHours: true },
      });
      expect(toast.success).toHaveBeenCalledWith('Remarcado ✓');
    });

    it('ignora o campo de dia apagado e, com um só profissional, não mostra a escolha', () => {
      show(appt(), [pros[0]]);
      fireEvent.click(btn(/Remarcar/));
      expect(screen.queryByLabelText('Profissional')).toBeNull();
      type('Dia', '');
      expect((screen.getByLabelText('Dia') as HTMLInputElement).value).toBe('2026-10-28');
    });
  });

  describe('observação', () => {
    it('o botão de salvar só aparece quando o texto muda', async () => {
      show(appt({ notes: 'antes' }));
      expect(screen.queryByRole('button', { name: 'Salvar observação' })).toBeNull();
      type('Observação', '  depois  ');
      fireEvent.click(btn('Salvar observação'));
      await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ id: 'ap1', body: { notes: 'depois' } }));
      expect(toast.success).toHaveBeenCalledWith('Observação salva');
    });

    it('apagar tudo grava null', async () => {
      show(appt({ notes: 'antes' }));
      type('Observação', '   ');
      fireEvent.click(btn('Salvar observação'));
      await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ id: 'ap1', body: { notes: null } }));
    });
  });
});
