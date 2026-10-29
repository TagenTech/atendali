import type { PublicOrgDto, SequencePlanDto } from '@skedulei/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const agenda = vi.hoisted(() => ({ publicSlots: vi.fn(), publicSequence: vi.fn(), publicBookGroup: vi.fn() }));
vi.mock('@/lib/api/agenda', () => agenda);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const device = vi.hoisted(() => ({ rememberBooking: vi.fn() }));
vi.mock('@/lib/my-bookings-device', () => device);

import { ApiError } from '@/lib/api/client';
import { renderWithQuery } from '@/test/render';
import { CartFlow } from './cart-flow';

const org = {
  vocabulary: { client: 'Paciente', services: 'Procedimentos' },
  professionals: [{ id: 'm1', name: 'Bia', color: 1 }],
} as unknown as PublicOrgDto;
const corte = { id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 5000 } as PublicOrgDto['services'][number];
const escova = { id: 's2', name: 'Escova', durationMinutes: 45, priceCents: 7000 } as PublicOrgDto['services'][number];
const days = ['2026-10-28', '2026-10-29', '2026-10-30'];

const plan: SequencePlanDto = {
  startsAt: '2026-10-29T13:00:00.000Z',
  items: [
    { serviceId: 's1', memberId: 'm1', startsAt: '2026-10-29T13:00:00.000Z', endsAt: '2026-10-29T13:30:00.000Z' },
    { serviceId: 's2', memberId: 'm1', startsAt: '2026-10-29T13:30:00.000Z', endsAt: '2026-10-29T14:15:00.000Z' },
  ],
};
const booked = {
  token: 'tok1',
  timezone: 'America/Sao_Paulo',
  items: [
    { serviceName: 'Corte', clientName: 'Pedrinho', startsAt: '2026-10-29T13:00:00.000Z' },
    { serviceName: 'Escova', clientName: 'Pedrinho', startsAt: '2026-10-29T13:30:00.000Z' },
  ],
};

function show() {
  renderWithQuery(<CartFlow slug="studio" org={org} selected={[corte, escova]} days={days} today="2026-10-28" tz="America/Sao_Paulo" />);
}
const click = (name: string | RegExp, role: 'button' | 'radio' = 'button') => fireEvent.click(screen.getByRole(role, { name }));
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillPatient = () => {
  type('Seu nome', 'Ana');
  type('Celular (WhatsApp)', '11988887777');
};

beforeEach(() => {
  vi.clearAllMocks();
  agenda.publicSequence.mockResolvedValue({ date: '2026-10-29', options: [plan] });
  agenda.publicSlots.mockResolvedValue({ slots: [{ startsAt: '2026-10-29T13:00:00.000Z' }, { startsAt: '2026-10-29T13:30:00.000Z' }, { startsAt: '2026-10-29T14:00:00.000Z' }] });
  agenda.publicBookGroup.mockResolvedValue(booked);
});

describe('CartFlow: um logo após o outro', () => {
  it('abre no modo sequência, com o total de duração, e pede o dia', () => {
    show();
    expect(screen.getByText(/Como quer encaixar os 2 procedimentos\?/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Um logo após o outro/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/1h 15min no total|1h15 no total|75 min no total/)).toBeTruthy();
    expect(screen.getByText(/Escolha um dia \(até 60 dias à frente\)/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dia 28/10' }).textContent).toContain('hoje');
    expect(screen.queryByText('Seus dados')).toBeNull();
  });

  it('escolhe o dia, vê os encaixes, escolhe um e preenche os dados', async () => {
    show();
    click('Dia 29/10');
    expect(agenda.publicSequence).toHaveBeenCalledWith('studio', '2026-10-29', ['s1', 's2']);
    const option = await screen.findByRole('button', { name: 'Começar às 10:00' });
    expect(option.textContent).toBe('10:00 → 11:15');
    fireEvent.click(option);
    const order = screen.getByRole('list', { name: 'Ordem dos procedimentos' });
    expect(within(order).getByText(/Corte/)).toBeTruthy();
    expect(within(order).getAllByText('com Bia')).toHaveLength(2);
    expect(screen.getByText('Seus dados')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar 2 procedimentos' })).toBeTruthy();
  });

  it('confirma: grava o grupo, guarda no aparelho e abre a reserva', async () => {
    show();
    click('Dia 29/10');
    fireEvent.click(await screen.findByRole('button', { name: 'Começar às 10:00' }));
    fillPatient();
    click('Confirmar 2 procedimentos');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/reserva/tok1'));
    expect(agenda.publicBookGroup).toHaveBeenCalledWith('studio', {
      items: [
        { serviceId: 's1', memberId: 'm1', startsAt: '2026-10-29T13:00:00.000Z' },
        { serviceId: 's2', memberId: 'm1', startsAt: '2026-10-29T13:30:00.000Z' },
      ],
      name: 'Ana',
      phone: '11988887777',
      email: null,
      patientName: undefined,
      patientBirthDate: undefined,
      relationship: undefined,
    });
    expect(device.rememberBooking).toHaveBeenCalledWith({
      token: 'tok1',
      slug: 'studio',
      serviceName: 'Corte + Escova',
      patientName: 'Pedrinho',
      startsAt: '2026-10-29T13:00:00.000Z',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('se o horário foi perdido, mostra o motivo e volta a escolher', async () => {
    agenda.publicBookGroup.mockRejectedValue(new ApiError(409, 'x', ['Esse horário acabou de ser ocupado']));
    show();
    click('Dia 29/10');
    fireEvent.click(await screen.findByRole('button', { name: 'Começar às 10:00' }));
    fillPatient();
    click('Confirmar 2 procedimentos');
    expect((await screen.findByRole('alert')).textContent).toBe('Esse horário acabou de ser ocupado');
    expect(screen.queryByText('Seus dados')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('erro sem detalhe usa a mensagem padrão', async () => {
    agenda.publicBookGroup.mockRejectedValue(new Error('rede'));
    show();
    click('Dia 29/10');
    fireEvent.click(await screen.findByRole('button', { name: 'Começar às 10:00' }));
    fillPatient();
    click('Confirmar 2 procedimentos');
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível agendar agora');
  });

  it('dia sem encaixe avisa; trocar de dia desfaz a escolha', async () => {
    show();
    click('Dia 29/10');
    fireEvent.click(await screen.findByRole('button', { name: 'Começar às 10:00' }));
    expect(screen.getByText('Seus dados')).toBeTruthy();
    agenda.publicSequence.mockResolvedValue({ date: '2026-10-30', options: [] });
    click('Dia 30/10');
    expect(screen.queryByText('Seus dados')).toBeNull();
    expect(await screen.findByText(/Não há horário com tudo em sequência/)).toBeTruthy();
  });

  it('enquanto procura mostra o esqueleto', async () => {
    agenda.publicSequence.mockReturnValue(new Promise(() => undefined));
    show();
    click('Dia 29/10');
    await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeTruthy());
  });
});

describe('CartFlow: horário de cada um', () => {
  const sep = () => click(/Escolher o horário de cada um/, 'radio');
  const section = (name: string) => within(screen.getByRole('region', { name }));

  it('mostra um bloco por procedimento pedindo o dia', () => {
    show();
    sep();
    expect(screen.getByText('Dia e horário de cada um')).toBeTruthy();
    expect(screen.getAllByText('Escolha o dia deste procedimento.')).toHaveLength(2);
    expect(screen.getByText(/1\. Corte/)).toBeTruthy();
    expect(screen.getByText(/2\. Escova/)).toBeTruthy();
  });

  it('escolhe dia e horário de cada um; o segundo não pode bater com o primeiro', async () => {
    show();
    sep();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Corte às 10:00' }));
    expect(agenda.publicSlots).toHaveBeenCalledWith('studio', { date: '2026-10-29', serviceId: 's1' });
    expect(screen.getByText(/29\/10 às 10:00/)).toBeTruthy();
    expect(screen.queryByText('Seus dados')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dia de Escova 29/10' }));
    await screen.findByRole('button', { name: 'Escova às 10:30' });
    // 10:00 bateria com o Corte (10:00–10:30)
    expect(screen.queryByRole('button', { name: 'Escova às 10:00' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Escova às 10:30' }));
    expect(screen.getByText('Seus dados')).toBeTruthy();
  });

  it('confirma com um horário para cada procedimento (sem profissional fixo)', async () => {
    show();
    sep();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Corte às 10:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Escova 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Escova às 11:00' }));
    fillPatient();
    click('Confirmar 2 procedimentos');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/reserva/tok1'));
    expect(agenda.publicBookGroup.mock.calls[0][1].items).toEqual([
      { serviceId: 's1', startsAt: '2026-10-29T13:00:00.000Z' },
      { serviceId: 's2', startsAt: '2026-10-29T14:00:00.000Z' },
    ]);
  });

  it('trocar o dia de um procedimento desfaz a escolha dele', async () => {
    show();
    sep();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Corte às 10:00' }));
    expect(section('Horário de Corte').getByText(/29\/10 às 10:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 30/10' }));
    expect(section('Horário de Corte').queryByText(/às 10:00/)).toBeNull();
  });

  it('dia sem horário livre avisa; enquanto carrega mostra o esqueleto', async () => {
    agenda.publicSlots.mockResolvedValue({ slots: [] });
    show();
    sep();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 29/10' }));
    expect(await screen.findByText(/Sem horários livres nesse dia/)).toBeTruthy();
  });

  it('esqueleto enquanto os horários chegam', async () => {
    agenda.publicSlots.mockReturnValue(new Promise(() => undefined));
    show();
    sep();
    fireEvent.click(screen.getByRole('button', { name: 'Dia de Corte 29/10' }));
    await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeTruthy());
  });

  it('trocar de modo limpa o erro anterior', async () => {
    agenda.publicBookGroup.mockRejectedValue(new Error('x'));
    show();
    click('Dia 29/10');
    fireEvent.click(await screen.findByRole('button', { name: 'Começar às 10:00' }));
    fillPatient();
    click('Confirmar 2 procedimentos');
    await screen.findByRole('alert');
    sep();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
