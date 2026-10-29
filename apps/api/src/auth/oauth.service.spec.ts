import type { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { OAuthError } from './auth.service';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  const make = (oauth: Record<string, { clientId: string; clientSecret: string } | null>) =>
    new OAuthService({ get: (k: string) => ({ publicWebUrl: 'https://app.exemplo.com', oauth })[k] } as unknown as ConfigService);
  const all = { google: { clientId: 'gid', clientSecret: 's' }, microsoft: { clientId: 'mid', clientSecret: 's' }, facebook: { clientId: 'fid', clientSecret: 's' } };

  it('só habilita provedores com credencial', () => {
    expect(make({ google: all.google, microsoft: null, facebook: null }).enabled()).toEqual(['google']);
    expect(make(all).enabled()).toEqual(['google', 'microsoft', 'facebook']);
  });

  it.each([
    ['google', 'https://accounts.google.com/o/oauth2/v2/auth', true],
    ['microsoft', 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', true],
    ['facebook', 'https://www.facebook.com/v19.0/dialog/oauth', false],
  ] as const)('%s: URL de autorização com state, redirect e PKCE', (provider, base, pkce) => {
    const { url, state } = make(all).start(provider);
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(base);
    expect(u.searchParams.get('redirect_uri')).toBe(`https://app.exemplo.com/api/v1/auth/oauth/${provider}/callback`);
    expect(u.searchParams.get('state')).toBe(state.state);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('code_challenge_method')).toBe(pkce ? 'S256' : null);
  });

  it('cada início gera state e verifier novos', () => {
    const svc = make(all);
    expect(svc.start('google').state.state).not.toBe(svc.start('google').state.state);
  });

  describe('troca do código e leitura do perfil (fetch simulado)', () => {
    const saved = (provider: 'google' | 'microsoft' | 'facebook') => ({ provider, state: 's', verifier: 'v' });
    const reply = (body: unknown, ok = true, status = 200) =>
      ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;
    let calls: { url: string; init?: RequestInit }[];
    const mockFetch = (routes: Record<string, Response>) =>
      jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        calls.push({ url, init });
        const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
        if (!hit) throw new Error(`fetch inesperado: ${url}`);
        return hit[1];
      });

    beforeEach(() => {
      calls = [];
    });
    afterEach(() => jest.restoreAllMocks());

    it('isProvider reconhece só os três provedores', () => {
      const svc = make(all);
      expect(svc.isProvider('google')).toBe(true);
      expect(svc.isProvider('twitter')).toBe(false);
    });

    it('Google: troca o código com PKCE e normaliza o e-mail; e-mail verificado vem do provedor', async () => {
      mockFetch({
        'https://oauth2.googleapis.com/token': reply({ access_token: 'tok' }),
        'https://openidconnect.googleapis.com/v1/userinfo': reply({ sub: 'g1', email: '  Ana@Exemplo.COM ', email_verified: true, name: 'Ana' }),
      });
      const profile = await make(all).finish('google', 'codigo', saved('google'));
      expect(profile).toEqual({ provider: 'google', providerUserId: 'g1', email: 'ana@exemplo.com', name: 'Ana', emailVerified: true });
      const body = String(calls[0].init?.body);
      expect(body).toContain('code_verifier=v');
      expect(body).toContain('client_secret=s');
      expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    });

    it('Google sem nome nem confirmação de e-mail', async () => {
      mockFetch({
        'https://oauth2.googleapis.com/token': reply({ access_token: 'tok' }),
        'https://openidconnect.googleapis.com/v1/userinfo': reply({ sub: 'g2', email: 'b@x.com' }),
      });
      expect(await make(all).finish('google', 'c', saved('google'))).toMatchObject({ name: '', emailVerified: false });
    });

    it('Microsoft: usa o e-mail do userinfo, ou cai no perfil do Graph; nunca considera verificado', async () => {
      mockFetch({
        'https://login.microsoftonline.com/common/oauth2/v2.0/token': reply({ access_token: 't' }),
        'https://graph.microsoft.com/oidc/userinfo': reply({ sub: 'm1', email: 'c@x.com', name: 'Cris' }),
      });
      expect(await make(all).finish('microsoft', 'c', saved('microsoft'))).toMatchObject({ email: 'c@x.com', emailVerified: false, name: 'Cris' });
      jest.restoreAllMocks();

      mockFetch({
        'https://login.microsoftonline.com/common/oauth2/v2.0/token': reply({ access_token: 't' }),
        'https://graph.microsoft.com/oidc/userinfo': reply({ sub: 'm2' }),
        'https://graph.microsoft.com/v1.0/me': reply({ userPrincipalName: 'upn@x.com' }),
      });
      expect(await make(all).finish('microsoft', 'c', saved('microsoft'))).toMatchObject({ email: 'upn@x.com', name: '' });
      jest.restoreAllMocks();

      mockFetch({
        'https://login.microsoftonline.com/common/oauth2/v2.0/token': reply({ access_token: 't' }),
        'https://graph.microsoft.com/oidc/userinfo': reply({ sub: 'm3' }),
        'https://graph.microsoft.com/v1.0/me': reply({ mail: 'mail@x.com' }),
      });
      expect((await make(all).finish('microsoft', 'c', saved('microsoft'))).email).toBe('mail@x.com');
      jest.restoreAllMocks();

      mockFetch({
        'https://login.microsoftonline.com/common/oauth2/v2.0/token': reply({ access_token: 't' }),
        'https://graph.microsoft.com/oidc/userinfo': reply({ sub: 'm4' }),
        'https://graph.microsoft.com/v1.0/me': reply({}),
      });
      await expect(make(all).finish('microsoft', 'c', saved('microsoft'))).rejects.toMatchObject({ code: 'email' });
    });

    it('Facebook: sem PKCE; exige e-mail e o considera verificado', async () => {
      mockFetch({
        'https://graph.facebook.com/v19.0/oauth/access_token': reply({ access_token: 'fb tok' }),
        'https://graph.facebook.com/v19.0/me': reply({ id: 'f1', email: 'd@x.com', name: 'Duda' }),
      });
      expect(await make(all).finish('facebook', 'c', saved('facebook'))).toEqual({ provider: 'facebook', providerUserId: 'f1', email: 'd@x.com', name: 'Duda', emailVerified: true });
      expect(String(calls[0].init?.body)).not.toContain('code_verifier');
      expect(calls[1].url).toContain(encodeURIComponent('fb tok'));
      expect((calls[1].init?.headers as object)).toEqual({});
      jest.restoreAllMocks();

      mockFetch({
        'https://graph.facebook.com/v19.0/oauth/access_token': reply({ access_token: 't' }),
        'https://graph.facebook.com/v19.0/me': reply({ id: 'f2' }),
      });
      await expect(make(all).finish('facebook', 'c', saved('facebook'))).rejects.toBeInstanceOf(OAuthError);
      jest.restoreAllMocks();

      mockFetch({
        'https://graph.facebook.com/v19.0/oauth/access_token': reply({ access_token: 't' }),
        'https://graph.facebook.com/v19.0/me': reply({ id: 'f3', email: 'e@x.com' }),
      });
      expect((await make(all).finish('facebook', 'c', saved('facebook'))).name).toBe('');
    });

    it('recusa quando o provedor rejeita o código, não devolve token ou o perfil falha', async () => {
      mockFetch({ 'https://oauth2.googleapis.com/token': reply({ error: 'invalid_grant' }, false, 400) });
      await expect(make(all).finish('google', 'c', saved('google'))).rejects.toMatchObject({ code: 'falhou' });
      jest.restoreAllMocks();

      mockFetch({ 'https://oauth2.googleapis.com/token': reply({}) });
      await expect(make(all).finish('google', 'c', saved('google'))).rejects.toMatchObject({ code: 'falhou' });
      jest.restoreAllMocks();

      mockFetch({
        'https://oauth2.googleapis.com/token': reply({ access_token: 't' }),
        'https://openidconnect.googleapis.com/v1/userinfo': reply({}, false, 500),
      });
      await expect(make(all).finish('google', 'c', saved('google'))).rejects.toThrow(/500/);
    });

    it('provedor sem credencial não inicia nem termina', async () => {
      const svc = make({ google: null, microsoft: null, facebook: null });
      expect(() => svc.start('google')).toThrow(BadRequestException);
      await expect(svc.finish('google', 'c', saved('google'))).rejects.toThrow(BadRequestException);
    });
  });
});
