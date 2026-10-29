import { GUARDIAN_RELATIONSHIPS, type ClientDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const agenda = vi.hoisted(() => ({ useSaveClient: vi.fn() }));
vi.mock('@/lib/queries/agenda', () => agenda);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { ClientSheet } from './client-sheet';

const existing = {
  id: 'c1',
  name: 'Maria Souza',
  phone: '11999998888',
  email: 'maria@x.com',
  birthDate: '1990-05-01',
  guardianName: 'José',
  guardianRelationship: GUARDIAN_RELATIONSHIPS[0],
  notes: 'alergia a látex',
  tags: ['vip', 'indicação'],
} as unknown as ClientDto;

let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function show(client: ClientDto | null = null) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(<ClientSheet client={client} onOpenChange={onOpenChange} onSaved={onSaved} />);
  return { onOpenChange, onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  save = { mutateAsync: vi.fn().mockResolvedValue({ id: 'novo', name: 'x' }), isPending: false };
  agenda.useSaveClient.mockImplementation(() => save);
});

describe('ClientSheet', () => {
  it('novo: título pelo vocabulário e campos vazios', () => {
    orgState.vocab = { ...orgState.vocab, client: 'Paciente' };
    show();
    expect(screen.getByRole('dialog', { name: 'Novo paciente' })).toBeTruthy();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('');
  });

  it('exige o nome e o erro some ao digitar', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert').textContent).toBe('Informe o nome');
    expect(save.mutateAsync).not.toHaveBeenCalled();
    type('Nome', 'A');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cadastra só com o nome: o resto vai como vazio', async () => {
    const { onOpenChange, onSaved } = show();
    type('Nome', '  Joana  ');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      id: undefined,
      body: { name: 'Joana', phone: null, email: null, birthDate: null, guardianName: null, guardianRelationship: null, notes: null, tags: [] },
    });
    expect(toast.success).toHaveBeenCalledWith('Cliente cadastrado ✨');
    expect(onSaved).toHaveBeenCalledWith({ id: 'novo', name: 'x' });
  });

  it('cadastra com tudo, inclusive responsável, parentesco e etiquetas', async () => {
    const { onOpenChange } = show();
    type('Nome', 'Pedro');
    type('Celular / WhatsApp', '(11) 98888-7777');
    type('E-mail', ' pedro@x.com ');
    type('Nascimento', '2018-03-04');
    expect((screen.getByLabelText('Parentesco') as HTMLSelectElement).disabled).toBe(true);
    type(/Responsável/, ' Ana ');
    expect((screen.getByLabelText('Parentesco') as HTMLSelectElement).disabled).toBe(false);
    type('Parentesco', GUARDIAN_RELATIONSHIPS[1]);
    type('Etiquetas', ' vip, , novo ');
    type('Observações', ' asma ');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      id: undefined,
      body: {
        name: 'Pedro',
        phone: '11988887777',
        email: 'pedro@x.com',
        birthDate: '2018-03-04',
        guardianName: 'Ana',
        guardianRelationship: GUARDIAN_RELATIONSHIPS[1],
        notes: 'asma',
        tags: ['vip', 'novo'],
      },
    });
  });

  it('editar: vem preenchido, grava pelo id e avisa que atualizou', async () => {
    const { onOpenChange } = show(existing);
    expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeTruthy();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Maria Souza');
    expect((screen.getByLabelText('Etiquetas') as HTMLInputElement).value).toBe('vip, indicação');
    expect((screen.getByLabelText('Parentesco') as HTMLSelectElement).value).toBe(GUARDIAN_RELATIONSHIPS[0]);
    type('Nome', 'Maria S.');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', body: expect.objectContaining({ name: 'Maria S.', guardianName: 'José', guardianRelationship: GUARDIAN_RELATIONSHIPS[0] }) }));
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado');
  });

  it('apagar o responsável apaga também o parentesco', async () => {
    show(existing);
    type(/Responsável/, '');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ guardianName: null, guardianRelationship: null });
  });

  it('responsável sem parentesco escolhido grava null no parentesco', async () => {
    show();
    type('Nome', 'Pedro');
    type(/Responsável/, 'Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ guardianName: 'Ana', guardianRelationship: null });
  });

  it('funciona sem o aviso onSaved e mostra o erro da API', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Esse celular já está cadastrado']));
    const onOpenChange = vi.fn();
    render(<ClientSheet client={null} onOpenChange={onOpenChange} />);
    type('Nome', 'Pedro');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esse celular já está cadastrado'));
    expect(onOpenChange).not.toHaveBeenCalled();
    save.mutateAsync.mockResolvedValue({ id: 'z' });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
