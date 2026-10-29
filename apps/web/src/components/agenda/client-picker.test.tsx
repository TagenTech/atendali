import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const agenda = vi.hoisted(() => ({ useClients: vi.fn() }));
vi.mock('@/lib/queries/agenda', () => agenda);

import { resetOrg } from '@/test/org-stub';
import { clientBody, ClientPicker, type PickedClient } from './client-picker';

/** Mantém o valor escolhido como a tela faz. */
function Harness({ initial = null, locked }: { initial?: PickedClient; locked?: boolean }) {
  const [v, setV] = React.useState<PickedClient>(initial);
  return (
    <>
      <ClientPicker value={v} onChange={setV} locked={locked} />
      <output data-testid="v">{JSON.stringify(v)}</output>
    </>
  );
}
const value = () => JSON.parse(screen.getByTestId('v').textContent!);

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  agenda.useClients.mockReturnValue({ data: [{ id: 'c1', name: 'Maria Souza', phone: '11999998888' }, { id: 'c2', name: 'Mario Lima', phone: null }] });
});

describe('ClientPicker', () => {
  it('sem busca não lista ninguém', () => {
    render(<Harness />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(agenda.useClients).toHaveBeenCalledWith('');
  });

  it('busca por nome e escolhe', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: ' mar ' } });
    expect(agenda.useClients).toHaveBeenLastCalledWith('mar');
    expect(screen.getByText('11999998888')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Maria Souza/ }));
    expect(value()).toEqual({ client: { id: 'c1', name: 'Maria Souza', phone: '11999998888' } });
    expect(screen.getByText('Maria Souza')).toBeTruthy();
  });

  it('trocar a pessoa volta à busca (a menos que esteja travada)', () => {
    const { unmount } = render(<Harness initial={{ client: { id: 'c1', name: 'Maria' } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cliente' }));
    expect(value()).toBeNull();
    unmount();
    render(<Harness initial={{ client: { id: 'c1', name: 'Maria' } }} locked />);
    expect(screen.queryByRole('button', { name: 'Trocar cliente' })).toBeNull();
  });

  it('cadastrar na hora: texto vira nome, número vira celular', () => {
    const { unmount } = render(<Harness />);
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Joana' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar “Joana”/ }));
    expect(value()).toEqual({ newClient: { name: 'Joana', phone: '' } });
    unmount();
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: '11988887777' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar/ }));
    expect(value()).toEqual({ newClient: { name: '', phone: '11988887777' } });
  });

  it('o novo cadastro aceita nome e celular, e dá para voltar à busca', () => {
    render(<Harness initial={{ newClient: { name: '', phone: '' } }} />);
    fireEvent.change(screen.getByLabelText('Nome do novo cadastro'), { target: { value: 'Joana' } });
    fireEvent.change(screen.getByLabelText('Celular do novo cadastro'), { target: { value: '(11) 98888-7777' } });
    expect(value()).toEqual({ newClient: { name: 'Joana', phone: '11988887777' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à busca' }));
    expect(value()).toBeNull();
  });

  it('celular com DDI de fora mantém o +', () => {
    render(<Harness initial={{ newClient: { name: 'Ana', phone: '' } }} />);
    fireEvent.change(screen.getByLabelText('Celular do novo cadastro'), { target: { value: '+351912345678' } });
    expect(value().newClient.phone).toBe('+351912345678');
  });
});

describe('clientBody', () => {
  it('pessoa existente vai pelo id', () => {
    expect(clientBody({ client: { id: 'c1', name: 'Maria' } })).toEqual({ clientId: 'c1' });
  });
  it('novo cadastro vai com nome sem espaços e celular (ou null)', () => {
    expect(clientBody({ newClient: { name: ' Ana ', phone: '11999998888' } })).toEqual({ newClient: { name: 'Ana', phone: '11999998888' } });
    expect(clientBody({ newClient: { name: 'Ana', phone: '' } })).toEqual({ newClient: { name: 'Ana', phone: null } });
  });
});
