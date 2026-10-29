import type { WaitlistEntryDto } from '@skedulei/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useWaitlist: vi.fn(), useAddWaitlist: vi.fn(), useResolveWaitlist: vi.fn(), useClients: vi.fn(), useServices: vi.fn() }));
vi.mock('@/lib/queries/agenda', () => ({ useWaitlist: q.useWaitlist, useAddWaitlist: q.useAddWaitlist, useResolveWaitlist: q.useResolveWaitlist, useClients: q.useClients }));
vi.mock('@/lib/queries/org', () => ({ useServices: q.useServices }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { renderWithQuery } from '@/test/render';
import { WaitlistSheet } from './waitlist-sheet';

const entry = (over: Partial<WaitlistEntryDto> = {}): WaitlistEntryDto =>
  ({
    id: 'w1',
    clientId: 'c1',
    clientName: 'Maria Souza',
    clientPhone: '11999998888',
    serviceId: 's1',
    serviceName: 'Corte',
    memberId: 'm1',
    memberName: 'Bia',
    preferredDate: '2026-10-30',
    notes: 'só depois das 17h',
    openSlot: null,
    ...over,
  }) as WaitlistEntryDto;

let add: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let resolve: { mutateAsync: ReturnType<typeof vi.fn> };
const pros = [{ id: 'm1', name: 'Bia' }];

function show(entries: WaitlistEntryDto[] = [entry()]) {
  q.useWaitlist.mockReturnValue({ data: entries });
  const onBook = vi.fn();
  const onOpenChange = vi.fn();
  renderWithQuery(<WaitlistSheet professionals={pros} defaultDate="2026-10-28" onBook={onBook} onOpenChange={onOpenChange} />);
  return { onBook, onOpenChange };
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  add = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  resolve = { mutateAsync: vi.fn().mockResolvedValue({}) };
  q.useAddWaitlist.mockImplementation(() => add);
  q.useResolveWaitlist.mockImplementation(() => resolve);
  q.useClients.mockReturnValue({ data: [{ id: 'c9', name: 'Ana Lima', phone: null }] });
  q.useServices.mockReturnValue({ data: [{ id: 's1', name: 'Corte', active: true }, { id: 's2', name: 'Velho', active: false }] });
});

describe('WaitlistSheet: lista', () => {
  it('sem ninguém, avisa', () => {
    show([]);
    expect(screen.getByText('Ninguém esperando vaga.')).toBeTruthy();
  });

  it('mostra quem espera, o que quer e a observação', () => {
    show();
    expect(screen.getByText('Maria Souza')).toBeTruthy();
    expect(screen.getByText(/Corte · Bia · /)).toBeTruthy();
    expect(screen.getByText('“só depois das 17h”')).toBeTruthy();
    expect(screen.queryByText(/Abriu vaga/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('pedido aberto a qualquer coisa', () => {
    show([entry({ serviceName: null, memberName: null, preferredDate: null, notes: null, memberId: null, serviceId: null })]);
    expect(screen.getByText('qualquer profissional · qualquer dia')).toBeTruthy();
  });

  it('quando abre vaga mostra o aviso e a mensagem pronta para o WhatsApp', () => {
    show([entry({ openSlot: { startsAt: '2026-10-29T17:00:00.000Z', memberId: 'm1', memberName: 'Bia' } as never })]);
    expect(screen.getByText(/Abriu vaga: .* às 14:00 com Bia/)).toBeTruthy();
    const wa = screen.getByRole('link', { name: /Avisar no WhatsApp/ });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href')!)).toMatch(/Maria/);
  });

  it('sem telefone não há WhatsApp mesmo com vaga', () => {
    show([entry({ clientPhone: null as never, openSlot: { startsAt: '2026-10-29T17:00:00.000Z', memberId: 'm1', memberName: 'Bia' } as never })]);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('agendar leva o pedido para o novo agendamento (com a vaga que abriu, se houver)', () => {
    const { onBook } = show([entry()]);
    fireEvent.click(btn(/Agendar/));
    expect(onBook).toHaveBeenCalledWith({ date: '2026-10-30', time: undefined, memberId: 'm1', serviceId: 's1', client: { id: 'c1', name: 'Maria Souza' }, waitlistId: 'w1' });
  });

  it('agendar uma vaga aberta usa o dia, a hora e o profissional da vaga', () => {
    const { onBook } = show([entry({ openSlot: { startsAt: '2026-10-29T17:00:00.000Z', memberId: 'm7', memberName: 'Caio' } as never })]);
    fireEvent.click(btn(/Agendar/));
    expect(onBook).toHaveBeenCalledWith({ date: '2026-10-29', time: '14:00', memberId: 'm7', serviceId: 's1', client: { id: 'c1', name: 'Maria Souza' }, waitlistId: 'w1' });
  });

  it('pedido sem preferência cai no dia da tela', () => {
    const { onBook } = show([entry({ preferredDate: null, memberId: null, serviceId: null })]);
    fireEvent.click(btn(/Agendar/));
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-28', memberId: undefined, serviceId: undefined }));
  });

  it('tirar da lista avisa; erro vira aviso', async () => {
    show();
    fireEvent.click(btn('Tirar Maria Souza da lista'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Saiu da lista de espera'));
    resolve.mutateAsync.mockRejectedValue(new ApiError(404, 'x', ['Pedido não existe mais']));
    fireEvent.click(btn('Tirar Maria Souza da lista'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Pedido não existe mais'));
  });
});

describe('WaitlistSheet: novo pedido', () => {
  const open = () => fireEvent.click(btn(/Adicionar à lista/));
  const pickAna = () => {
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /Ana Lima/ }));
  };

  it('abre e cancela', () => {
    show([]);
    open();
    expect(screen.getByText('Novo pedido')).toBeTruthy();
    fireEvent.click(btn('Cancelar'));
    expect(screen.queryByText('Novo pedido')).toBeNull();
  });

  it('exige a pessoa (ou o nome de um novo cadastro) e o erro some ao escolher', () => {
    orgState.vocab = { ...orgState.vocab, client: 'Paciente' };
    show([]);
    open();
    fireEvent.click(btn('Colocar na lista'));
    expect(screen.getByRole('alert').textContent).toBe('Escolha o paciente ou informe o nome');
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: '119' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar/ }));
    fireEvent.click(btn('Colocar na lista'));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nome do novo cadastro'), { target: { value: 'Joana' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('coloca na lista com tudo preenchido e limpa para o próximo', async () => {
    show([]);
    open();
    pickAna();
    expect(within(screen.getByLabelText('Serviço (opcional)')).queryByRole('option', { name: 'Velho' })).toBeNull();
    type('Serviço (opcional)', 's1');
    type('Profissional', 'm1');
    type('Dia', '2026-11-02');
    type('Observação', ' manhã ');
    fireEvent.click(btn('Colocar na lista'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Na lista de espera ✓'));
    expect(add.mutateAsync).toHaveBeenCalledWith({ clientId: 'c9', serviceId: 's1', memberId: 'm1', preferredDate: '2026-11-02', notes: 'manhã' });
    expect(screen.queryByText('Novo pedido')).toBeNull();
  });

  it('pedido aberto: sem serviço, profissional, dia nem observação vai como null', async () => {
    show([]);
    open();
    pickAna();
    type('Dia', '');
    fireEvent.click(btn('Colocar na lista'));
    await waitFor(() => expect(add.mutateAsync).toHaveBeenCalled());
    expect(add.mutateAsync).toHaveBeenCalledWith({ clientId: 'c9', serviceId: null, memberId: null, preferredDate: null, notes: null });
  });

  it('erro da API vira aviso e o formulário continua', async () => {
    add.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Já está na lista']));
    show([]);
    open();
    pickAna();
    fireEvent.click(btn('Colocar na lista'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já está na lista'));
    expect(screen.getByText('Novo pedido')).toBeTruthy();
  });
});
