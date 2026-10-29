import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const orgApi = vi.hoisted(() => ({ myOrganizations: vi.fn(), getOrganization: vi.fn() }));
vi.mock('./api/org', () => orgApi);
const client = vi.hoisted(() => ({ setActiveOrganization: vi.fn() }));
vi.mock('./api/client', () => client);

import { OrgProvider, useActivateOrg, useOrg, useOrgState, orgKeys } from './org';

const summary = (id: string) => ({ id, name: `Negócio ${id}`, slug: id, segment: 'SALAO_BELEZA', role: 'DONO' });
const full = (id: string) => ({ id, name: `Negócio ${id}`, features: ['ESTOQUE'], vocabulary: { client: 'Cliente' }, me: { permissions: ['CLIENTS_MANAGE'] } });

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

describe('org', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    orgApi.getOrganization.mockImplementation(async (id: string) => full(id));
  });
  afterEach(cleanup);

  it('chaves de cache por negócio', () => {
    expect(orgKeys.org('x')).toEqual(['org', 'x']);
    expect(orgKeys.units('x')).toEqual(['org', 'x', 'units']);
    expect(orgKeys.members('x')).toEqual(['org', 'x', 'members']);
    expect(orgKeys.services('x')).toEqual(['org', 'x', 'services']);
  });

  it('carrega e fica pronto com o primeiro negócio; permissões e módulos vêm do negócio', async () => {
    orgApi.myOrganizations.mockResolvedValue([summary('a'), summary('b')]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrgState(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('esperava ready');
    const v = result.current.value;
    expect(v.org.id).toBe('a');
    expect(v.can('CLIENTS_MANAGE' as never)).toBe(true);
    expect(v.can('FINANCE_VIEW' as never)).toBe(false);
    expect(v.has('ESTOQUE' as never)).toBe(true);
    expect(v.has('PACOTES' as never)).toBe(false);
    expect(client.setActiveOrganization).toHaveBeenCalledWith('a');
  });

  it('lembra o negócio escolhido por último e troca ao vivo', async () => {
    orgApi.myOrganizations.mockResolvedValue([summary('a'), summary('b')]);
    localStorage.setItem('skedulei_org', 'b');
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrgState(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const first = result.current;
    if (first.status !== 'ready') throw new Error();
    expect(first.value.org.id).toBe('b');
    act(() => first.value.switchOrg('a'));
    await waitFor(() => expect(result.current.status === 'ready' && result.current.value.org.id).toBe('a'));
    expect(localStorage.getItem('skedulei_org')).toBe('a');
    // Um id guardado que não é mais da conta cai no primeiro.
    localStorage.setItem('skedulei_org', 'sumiu');
    const again = renderHook(() => useOrgState(), { wrapper: setup().wrapper });
    await waitFor(() => expect(again.result.current.status).toBe('ready'));
    if (again.result.current.status !== 'ready') throw new Error();
    expect(again.result.current.value.org.id).toBe('a');
  });

  it('conta sem negócio vai para o onboarding', async () => {
    orgApi.myOrganizations.mockResolvedValue([]);
    const { result } = renderHook(() => useOrgState(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.status).toBe('none'));
  });

  it('erro na lista ou no negócio oferece tentar de novo', async () => {
    orgApi.myOrganizations.mockRejectedValueOnce(new Error('fora'));
    const a = renderHook(() => useOrgState(), { wrapper: setup().wrapper });
    await waitFor(() => expect(a.result.current.status).toBe('error'));
    orgApi.myOrganizations.mockResolvedValue([summary('a')]);
    if (a.result.current.status !== 'error') throw new Error();
    act(() => a.result.current.status === 'error' && a.result.current.retry());
    await waitFor(() => expect(a.result.current.status).toBe('ready'));

    orgApi.myOrganizations.mockResolvedValue([summary('a')]);
    orgApi.getOrganization.mockRejectedValueOnce(new Error('fora'));
    const b = renderHook(() => useOrgState(), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.status).toBe('error'));
    act(() => b.result.current.status === 'error' && b.result.current.retry());
    await waitFor(() => expect(b.result.current.status).toBe('ready'));
  });

  it('useOrg fora do provider avisa; dentro devolve o valor', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useOrg())).toThrow(/OrgProvider/);
    spy.mockRestore();
    const value = { org: { id: 'x' } } as never;
    const { result } = renderHook(() => useOrg(), { wrapper: ({ children }) => <OrgProvider value={value}>{children}</OrgProvider> });
    expect(result.current).toBe(value);
  });

  it('useActivateOrg guarda o negócio e recarrega a lista', async () => {
    const { qc, wrapper } = setup();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useActivateOrg(), { wrapper });
    await act(async () => result.current('novo'));
    expect(localStorage.getItem('skedulei_org')).toBe('novo');
    expect(spy).toHaveBeenCalledWith({ queryKey: orgKeys.mine });
  });

  it('localStorage negado não quebra', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negado');
    });
    orgApi.myOrganizations.mockResolvedValue([summary('a')]);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => ({ state: useOrgState(), activate: useActivateOrg() }), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    await act(async () => result.current.activate('b'));
    expect(qc).toBeTruthy();
  });
});
