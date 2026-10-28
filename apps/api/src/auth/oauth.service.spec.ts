import type { ConfigService } from '@nestjs/config';
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
});
