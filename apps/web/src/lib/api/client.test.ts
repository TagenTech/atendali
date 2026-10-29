import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORG_HEADER } from '@skedulei/contracts';
import { api, ApiError, apiAsset, downloadFile, errorText, refreshSession, SessionUnavailableError, setAccessToken, setActiveOrganization, setSessionExpiredHandler } from './client';

const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers });

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const headersOf = (call = 0) => new Headers((fetchMock.mock.calls[call][1] as RequestInit).headers);

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
    setActiveOrganization(null);
    setSessionExpiredHandler(null);
  });
  afterEach(() => vi.useRealTimers());

  describe('api()', () => {
    it('manda token, negócio ativo e JSON; 204 volta vazio', async () => {
      setAccessToken('tok');
      setActiveOrganization('org-1');
      fetchMock.mockResolvedValueOnce(reply(200, { ok: true })).mockResolvedValueOnce(reply(204));
      expect(await api('/org/x', { method: 'POST', body: '{}' })).toEqual({ ok: true });
      const h = headersOf();
      expect(h.get('authorization')).toBe('Bearer tok');
      expect(h.get('content-type')).toBe('application/json');
      expect(h.get(ORG_HEADER)).toBe('org-1');
      expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/org/x');
      expect(await api('/org/y')).toBeUndefined();
    });

    it('não sobrescreve o cabeçalho do negócio que a chamada já mandou; sem token nem negócio não manda nada', async () => {
      setAccessToken('tok');
      setActiveOrganization('org-1');
      fetchMock.mockResolvedValue(reply(200, {}));
      await api('/org/x', { headers: { [ORG_HEADER]: 'org-2', 'content-type': 'text/plain' }, body: 'x' });
      expect(headersOf().get(ORG_HEADER)).toBe('org-2');
      expect(headersOf().get('content-type')).toBe('text/plain');
      setAccessToken(null);
      setActiveOrganization(null);
      await api('/publico');
      expect(headersOf(1).has('authorization')).toBe(false);
      expect(headersOf(1).has(ORG_HEADER)).toBe(false);
    });

    it('token do portal vale no lugar do login e nunca renova a sessão do app', async () => {
      setAccessToken('tok');
      fetchMock.mockResolvedValue(reply(401, { message: 'Código vencido' }));
      await expect(api('/public/portal/me', { portalToken: 'portal' })).rejects.toMatchObject({ status: 401, message: 'Código vencido' });
      expect(headersOf().get('authorization')).toBe('Bearer portal');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('erro vira ApiError com a mensagem e os detalhes da API; sem corpo usa mensagem padrão', async () => {
      fetchMock.mockResolvedValueOnce(reply(400, { message: 'Confira os campos', details: ['nome é obrigatório'] })).mockResolvedValueOnce(new Response('<html>', { status: 502 }));
      await expect(api('/x')).rejects.toMatchObject({ status: 400, message: 'Confira os campos', details: ['nome é obrigatório'] });
      await expect(api('/x')).rejects.toMatchObject({ status: 502, message: 'Não foi possível falar com o servidor' });
    });

    it('sem rede vira erro status 0', async () => {
      fetchMock.mockRejectedValue(new TypeError('failed'));
      await expect(api('/x')).rejects.toMatchObject({ status: 0, message: 'Sem conexão. Confira sua internet.' });
    });

    it('401 renova a sessão e repete a chamada uma vez', async () => {
      fetchMock
        .mockResolvedValueOnce(reply(401, { message: 'Expirou' }))
        .mockResolvedValueOnce(reply(200, { accessToken: 'novo', user: {} }))
        .mockResolvedValueOnce(reply(200, { dados: 1 }));
      expect(await api('/org/x')).toEqual({ dados: 1 });
      expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
      expect(headersOf(2).get('authorization')).toBe('Bearer novo');
    });

    it('sessão realmente vencida: avisa o app e devolve o 401', async () => {
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      setAccessToken('velho');
      fetchMock.mockResolvedValueOnce(reply(401, { message: 'Expirou' })).mockResolvedValueOnce(reply(401, {}));
      await expect(api('/org/x')).rejects.toMatchObject({ status: 401 });
      expect(expired).toHaveBeenCalledTimes(1);
    });

    it('sessão vencida sem ninguém escutando também não quebra', async () => {
      fetchMock.mockResolvedValueOnce(reply(401, {})).mockResolvedValueOnce(reply(403, {}));
      await expect(api('/org/x')).rejects.toMatchObject({ status: 401 });
    });

    it('servidor fora ao renovar: devolve o erro sem deslogar', async () => {
      vi.useFakeTimers();
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      fetchMock.mockImplementation(async (url: string) => (url.endsWith('/auth/refresh') ? reply(503, {}) : reply(401, { message: 'Expirou' })));
      const p = api('/org/x');
      const assertion = expect(p).rejects.toMatchObject({ status: 401 });
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(expired).not.toHaveBeenCalled();
    });

    it('rotas /auth e /public não tentam renovar', async () => {
      fetchMock.mockResolvedValue(reply(401, { message: 'Senha errada' }));
      await expect(api('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 });
      await expect(api('/public/orgs/x')).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshSession()', () => {
    it('chamadas simultâneas compartilham a mesma requisição e guardam o token', async () => {
      fetchMock.mockResolvedValue(reply(200, { accessToken: 'abc', user: { id: 'u' } }));
      const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
      expect(a).toBe(b);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      fetchMock.mockResolvedValueOnce(reply(200, { dados: 1 }));
      await api('/x');
      expect(headersOf(1).get('authorization')).toBe('Bearer abc');
    });

    it('401 e 403 significam sessão encerrada (null)', async () => {
      fetchMock.mockResolvedValueOnce(reply(401, {}));
      expect(await refreshSession()).toBeNull();
      fetchMock.mockResolvedValueOnce(reply(403, {}));
      expect(await refreshSession()).toBeNull();
    });

    it('falha passageira tenta de novo com espera; persistindo, vira SessionUnavailableError', async () => {
      vi.useFakeTimers();
      fetchMock.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(reply(429, {})).mockResolvedValueOnce(reply(200, { accessToken: 'ok', user: {} }));
      const ok = refreshSession();
      await vi.advanceTimersByTimeAsync(3000);
      expect((await ok)?.accessToken).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(3);

      fetchMock.mockReset();
      fetchMock.mockResolvedValue(reply(500, {}));
      const down = refreshSession();
      const assertion = expect(down).rejects.toBeInstanceOf(SessionUnavailableError);
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });

    it('baixa com o nome do servidor ou o padrão', async () => {
      setAccessToken('tok');
      fetchMock.mockResolvedValueOnce(new Response('a,b', { status: 200, headers: { 'content-disposition': 'attachment; filename="clientes-2026.csv"' } }));
      const created: string[] = [];
      const original = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = original(tag);
        if (tag === 'a') created.push('a');
        return el;
      });
      await downloadFile('/org/clients/export', 'padrao.csv');
      expect(created).toEqual(['a']);
      expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ authorization: 'Bearer tok' });
      fetchMock.mockResolvedValueOnce(new Response('x', { status: 200 }));
      setAccessToken(null);
      await downloadFile('/org/clients/export', 'padrao.csv');
      expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({});
    });

    it('401 renova e tenta de novo; erro final vira ApiError', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 401 }))
        .mockResolvedValueOnce(reply(200, { accessToken: 'n', user: {} }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));
      await downloadFile('/x', 'x.csv');
      expect(fetchMock).toHaveBeenCalledTimes(3);
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(new Response('', { status: 500 }));
      await expect(downloadFile('/x', 'x.csv')).rejects.toMatchObject({ status: 500, message: 'Não foi possível exportar' });
    });

    it('401 com renovação que falha também é erro', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(reply(401, {})).mockResolvedValue(new Response('', { status: 401 }));
      await expect(downloadFile('/x', 'x.csv')).rejects.toBeInstanceOf(ApiError);
    });
  });

  it('errorText e apiAsset', () => {
    expect(errorText(new ApiError(400, 'Ruim', ['Campo X inválido']))).toBe('Campo X inválido');
    expect(errorText(new ApiError(400, 'Ruim'))).toBe('Ruim');
    expect(errorText(new Error('x'))).toBe('Não foi possível salvar');
    expect(errorText(null, 'Falhou')).toBe('Falhou');
    expect(apiAsset('/public/orgs/x/logo')).toBe('/api/v1/public/orgs/x/logo');
    expect(apiAsset(null)).toBeUndefined();
    expect(apiAsset(undefined)).toBeUndefined();
  });
});
