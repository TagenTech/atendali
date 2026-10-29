import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({
  useAgendaDay: vi.fn(),
  useCreateAppointment: vi.fn(),
  useResolveWaitlist: vi.fn(),
  useSlots: vi.fn(),
  useClients: vi.fn(),
  useServices: vi.fn(),
}));
vi.mock('@/lib/queries/agenda', () => ({
  useAgendaDay: q.useAgendaDay,
  useCreateAppointment: q.useCreateAppointment,
  useResolveWaitlist: q.useResolveWaitlist,
  useSlots: q.useSlots,
  useClients: q.useClients,
}));
vi.mock('@/lib/queries/org', () => ({ useServices: q.useServices }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { renderWithQuery } from '@/test/render';
import { NewAppointmentSheet, type NewAppointmentPrefill } from './new-appointment-sheet';

let create: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let resolve: { mutateAsync: ReturnType<typeof vi.fn> };

function show(prefill: Partial<NewAppointmentPrefill> = {}, open = true) {
  const onOpenChange = vi.fn();
  renderWithQuery(<NewAppointmentSheet open={open} onOpenChange={onOpenChange} prefill={{ date: '2026-10-28', ...prefill }} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
const alert = () => screen.queryByRole('alert')?.textContent;
const maria = { client: { id: 'c1', name: 'Maria' } };

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  create = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  resolve = { mutateAsync: vi.fn().mockResolvedValue({}) };
  q.useCreateAppointment.mockImplementation(() => create);
  q.useResolveWaitlist.mockImplementation(() => resolve);
  q.useServices.mockReturnValue({
    data: [
      { id: 's1', name: 'Corte', durationMinutes: 45, priceCents: 5000, active: true },
      { id: 's2', name: 'Consulta', durationMinutes: 30, priceCents: 0, active: true },
      { id: 's3', name: 'Velho', durationMinutes: 30, priceCents: 100, active: false },
    ],
  });
  q.useAgendaDay.mockReturnValue({ data: { professionals: [{ id: 'm1', name: 'Bia' }, { id: 'm2', name: 'Caio' }] } });
  q.useSlots.mockReturnValue({ data: { slots: [{ startsAt: '2026-10-28T13:00:00Z' }, { startsAt: '2026-10-28T13:30:00Z' }] } });
  q.useClients.mockReturnValue({ data: [] });
});

describe('NewAppointmentSheet', () => {
  it('fechado não mostra nada', () => {
    show({}, false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('título e rótulos seguem o vocabulário, sem depender do gênero da palavra', () => {
    orgState.vocab = { ...orgState.vocab, client: 'Paciente', service: 'Procedimento', appointment: 'Consulta' };
    show();
    expect(screen.getByRole('dialog', { name: 'Marcar consulta' })).toBeTruthy();
    expect(screen.getByText('Paciente')).toBeTruthy();
    expect(screen.getByLabelText('Procedimento')).toBeTruthy();
  });

  it('lista só serviços ativos, com duração e preço (ou gratuito)', () => {
    show();
    expect(screen.getByRole('option', { name: /Corte · 45 min · .*50,00/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Consulta · 30 min · gratuito/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Velho/ })).toBeNull();
  });

  it('cada pendência recebe a sua mensagem, na ordem', async () => {
    show();
    submit();
    expect(alert()).toBe('Escolha ou cadastre o cliente');
    // novo cadastro sem nome também conta como pendente
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: '119' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar/ }));
    submit();
    expect(alert()).toBe('Escolha ou cadastre o cliente');
    fireEvent.change(screen.getByLabelText('Nome do novo cadastro'), { target: { value: 'Joana' } });
    submit();
    expect(alert()).toBe('Escolha o serviço');
    type('Serviço', 's1');
    submit();
    expect(alert()).toBe('Escolha o horário');
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('sem profissional disponível no dia, pede o profissional', () => {
    q.useAgendaDay.mockReturnValue({ data: undefined });
    orgState.permissions = ['agenda.view_all'];
    show({ client: { id: 'c1', name: 'Maria' }, serviceId: 's1', time: '10:00' });
    submit();
    expect(alert()).toBe('Escolha o profissional');
  });

  it('mostra os horários livres e escolher um preenche o campo', () => {
    show({ serviceId: 's1' });
    expect(screen.getByText('Livres para 45 min')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    expect((screen.getByLabelText('Horário') as HTMLInputElement).value).toBe('10:00');
    expect(screen.getByRole('button', { name: '10:00' }).getAttribute('aria-pressed')).toBe('true');
    expect(q.useSlots).toHaveBeenLastCalledWith({ date: '2026-10-28', serviceId: 's1', memberId: 'm1' });
  });

  it('sem horário livre avisa e sugere encaixe', () => {
    q.useSlots.mockReturnValue({ data: { slots: [] } });
    show({ serviceId: 's1' });
    expect(screen.getByText(/Sem horário livre nesse dia/)).toBeTruthy();
    q.useSlots.mockReturnValue({ data: undefined });
  });

  it('agenda com cliente e serviço pré-escolhidos (vindo da lista de espera) e tira o pedido da fila', async () => {
    const onOpenChange = show({ client: maria.client, serviceId: 's1', memberId: 'm2', time: '10:00', waitlistId: 'w1' });
    // pessoa travada: não dá para trocar
    expect(screen.queryByRole('button', { name: 'Trocar cliente' })).toBeNull();
    type(/Observação/, ' fundo ');
    fireEvent.click(screen.getByRole('switch'));
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create.mutateAsync).toHaveBeenCalledWith({
      clientId: 'c1',
      serviceId: 's1',
      memberId: 'm2',
      startsAt: '2026-10-28T13:00:00.000Z',
      notes: 'fundo',
      allowOutsideHours: true,
    });
    expect(resolve.mutateAsync).toHaveBeenCalledWith('w1');
    expect(toast.success).toHaveBeenCalledWith('Horário marcado ✨');
  });

  it('falha ao tirar da lista de espera não desfaz o agendamento', async () => {
    resolve.mutateAsync.mockRejectedValue(new Error('x'));
    const onOpenChange = show({ client: maria.client, serviceId: 's1', time: '10:00', waitlistId: 'w1' });
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('cadastra a pessoa junto, sem observação e pelo primeiro profissional do dia', async () => {
    const onOpenChange = show({ serviceId: 's2' });
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Joana' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar/ }));
    type('Horário', '11:15');
    type('Dia', '2026-10-29');
    expect(q.useAgendaDay).toHaveBeenLastCalledWith('2026-10-29');
    type('Dia', '');
    expect((screen.getByLabelText('Dia') as HTMLInputElement).value).toBe('2026-10-29');
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create.mutateAsync).toHaveBeenCalledWith({
      newClient: { name: 'Joana', phone: null },
      serviceId: 's2',
      memberId: 'm1',
      startsAt: '2026-10-29T14:15:00.000Z',
      notes: null,
      allowOutsideHours: false,
    });
    expect(resolve.mutateAsync).not.toHaveBeenCalled();
  });

  it('quem só vê a própria agenda já vem como profissional', () => {
    orgState.org = { ...orgState.org, me: { memberId: 'm2' } };
    show({ client: maria.client, serviceId: 's1' });
    expect((screen.getByLabelText('Profissional') as HTMLSelectElement).value).toBe('m2');
    type('Profissional', 'm1');
    expect((screen.getByLabelText('Profissional') as HTMLSelectElement).value).toBe('m1');
  });

  it('quem vê a agenda toda começa pelo primeiro da lista', () => {
    orgState.permissions = ['agenda.view_all'];
    show({ client: maria.client });
    expect((screen.getByLabelText('Profissional') as HTMLSelectElement).value).toBe('m1');
  });

  it('erro da API aparece no próprio painel, com o motivo', async () => {
    create.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Esse horário acabou de ser ocupado']));
    const onOpenChange = show({ client: maria.client, serviceId: 's1', time: '10:00' });
    submit();
    await waitFor(() => expect(alert()).toBe('Esse horário acabou de ser ocupado'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('erro sem detalhe usa a mensagem padrão', async () => {
    create.mutateAsync.mockRejectedValue(new Error('rede'));
    show({ client: maria.client, serviceId: 's1', time: '10:00' });
    submit();
    await waitFor(() => expect(alert()).toBe('Não foi possível agendar'));
  });
});
