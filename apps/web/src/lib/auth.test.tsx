import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

const api = vi.hoisted(() => ({
  login: vi.fn(),
  verifyMfa: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('./api/auth', () => api);

const client = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
  expired: null as null | (() => void),
}));
vi.mock('./api/client', () => ({
  refreshSession: client.refreshSession,
  setAccessToken: client.setAccessToken,
  setSessionExpiredHandler: (fn: (() => void) | null) => {
    client.expired = fn;
  },
}));

import { AuthProvider, useAuth } from './auth';

const user = { id: 'u1', name: 'Ana', email: 'ana@x.com' };
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/hoje');
  });
  afterEach(cleanup);

  it('useAuth fora do provider avisa', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });

  it('restaura a sessão pelo cookie', async () => {
    client.refreshSession.mockResolvedValue({ user, accessToken: 't' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(user);
  });

  it('sem sessão vira anônimo; servidor fora vira "indisponível"', async () => {
    client.refreshSession.mockResolvedValue(null);
    const a = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(a.result.current.status).toBe('anonymous'));
    expect(a.result.current.user).toBeNull();
    client.refreshSession.mockRejectedValue(new Error('fora'));
    const b = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(b.result.current.status).toBe('unavailable'));
  });

  it('nas telas de entrada nem tenta restaurar', async () => {
    window.history.pushState({}, '', '/login');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  it('login: entra direto ou devolve o ticket do 2FA; completeMfa conclui', async () => {
    client.refreshSession.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    api.login.mockResolvedValueOnce({ mfaRequired: true, mfaToken: 'tic' });
    let r: { mfaToken?: string } = {};
    await act(async () => {
      r = await result.current.login({ email: 'a@x.com', password: 'senha' });
    });
    expect(r).toEqual({ mfaToken: 'tic' });
    expect(result.current.status).toBe('anonymous');

    api.verifyMfa.mockResolvedValueOnce({ user, accessToken: 't' });
    await act(async () => result.current.completeMfa('tic', '123456'));
    expect(result.current.status).toBe('authenticated');

    api.login.mockResolvedValueOnce({ user: { ...user, name: 'Direto' }, accessToken: 't' });
    await act(async () => {
      r = await result.current.login({ email: 'a@x.com', password: 'senha' });
    });
    expect(r).toEqual({});
    expect(result.current.user?.name).toBe('Direto');
  });

  it('cadastro, recarregar a conta e atualizar em memória', async () => {
    client.refreshSession.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    api.register.mockResolvedValueOnce({ user, accessToken: 't' });
    await act(async () => result.current.register({ name: 'Ana', email: 'ana@x.com', password: 'senha-forte-123', acceptTerms: true }));
    expect(result.current.status).toBe('authenticated');
    api.getMe.mockResolvedValueOnce({ ...user, name: 'Ana Maria' });
    await act(async () => result.current.reloadUser());
    expect(result.current.user?.name).toBe('Ana Maria');
    act(() => result.current.setUser({ ...user, name: 'Local' } as never));
    expect(result.current.user?.name).toBe('Local');
  });

  it('sair leva ao login, mesmo se a API falhar', async () => {
    client.refreshSession.mockResolvedValue({ user, accessToken: 't' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    api.logout.mockResolvedValueOnce(undefined);
    await act(async () => result.current.logout());
    expect(result.current.status).toBe('anonymous');
    expect(nav.replace).toHaveBeenCalledWith('/login');

    client.refreshSession.mockResolvedValue({ user, accessToken: 't' });
    const again = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(again.result.current.status).toBe('authenticated'));
    api.logout.mockRejectedValueOnce(new Error('fora'));
    await act(async () => again.result.current.logout());
    expect(client.setAccessToken).toHaveBeenCalledWith(null);
    expect(again.result.current.status).toBe('anonymous');
  });

  it('sessão vencida no meio do uso derruba para o login; ao desmontar solta o ouvinte', async () => {
    client.refreshSession.mockResolvedValue({ user, accessToken: 't' });
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    act(() => client.expired?.());
    expect(result.current.status).toBe('anonymous');
    expect(nav.replace).toHaveBeenCalledWith('/login');
    unmount();
    expect(client.expired).toBeNull();
  });

  it('renderiza os filhos', async () => {
    client.refreshSession.mockResolvedValue(null);
    const { findByText } = render(
      <AuthProvider>
        <p>conteúdo</p>
      </AuthProvider>,
    );
    expect(await findByText('conteúdo')).toBeTruthy();
  });
});
