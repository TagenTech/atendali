import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { AuthProvider } from '@agendei/contracts';
import type { AppConfig } from '../config/configuration';
import { OAuthError, type ProviderProfile } from './auth.service';

interface ProviderSpec {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  pkce: boolean;
  extra?: Record<string, string>;
  profile: (accessToken: string) => Promise<ProviderProfile>;
}

async function getJson<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

const SPECS: Record<AuthProvider, ProviderSpec> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    extra: { prompt: 'select_account' },
    profile: async (token) => {
      const u = await getJson<{ sub: string; email: string; email_verified: boolean; name?: string }>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        token,
      );
      return { provider: 'google', providerUserId: u.sub, email: u.email, name: u.name ?? '', emailVerified: !!u.email_verified };
    },
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile User.Read',
    pkce: true,
    extra: { prompt: 'select_account' },
    profile: async (token) => {
      const u = await getJson<{ sub: string; email?: string; name?: string }>('https://graph.microsoft.com/oidc/userinfo', token);
      let email = u.email;
      if (!email) {
        const me = await getJson<{ mail?: string; userPrincipalName?: string }>('https://graph.microsoft.com/v1.0/me', token);
        email = me.mail ?? me.userPrincipalName;
      }
      if (!email) throw new OAuthError('email');
      // Contas corporativas podem declarar qualquer e-mail: não usamos para ligar contas existentes.
      return { provider: 'microsoft', providerUserId: u.sub, email, name: u.name ?? '', emailVerified: false };
    },
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'email,public_profile',
    pkce: false,
    profile: async (token) => {
      const u = await getJson<{ id: string; name?: string; email?: string }>(
        `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`,
      );
      if (!u.email) throw new OAuthError('email');
      // A Meta só devolve e-mails confirmados.
      return { provider: 'facebook', providerUserId: u.id, email: u.email, name: u.name ?? '', emailVerified: true };
    },
  },
};

export interface OAuthState {
  provider: AuthProvider;
  state: string;
  verifier: string;
}

const b64url = (buf: Buffer) => buf.toString('base64url');

/** OAuth 2.0 (authorization code) com state anti-CSRF e PKCE quando o provedor suporta. */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly config: ConfigService) {}

  enabled(): AuthProvider[] {
    const oauth = this.config.get<AppConfig['oauth']>('oauth')!;
    return (Object.keys(SPECS) as AuthProvider[]).filter((p) => !!oauth[p]);
  }

  isProvider(p: string): p is AuthProvider {
    return Object.values(AuthProvider).includes(p as AuthProvider);
  }

  redirectUri(provider: AuthProvider) {
    return `${this.config.get<string>('publicWebUrl')}/api/v1/auth/oauth/${provider}/callback`;
  }

  start(provider: AuthProvider): { url: string; state: OAuthState } {
    const creds = this.creds(provider);
    const spec = SPECS[provider];
    const state = b64url(randomBytes(24));
    const verifier = b64url(randomBytes(32));
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: spec.scope,
      state,
      ...(spec.extra ?? {}),
    });
    if (spec.pkce) {
      params.set('code_challenge', b64url(createHash('sha256').update(verifier).digest()));
      params.set('code_challenge_method', 'S256');
    }
    return { url: `${spec.authUrl}?${params}`, state: { provider, state, verifier } };
  }

  async finish(provider: AuthProvider, code: string, saved: OAuthState): Promise<ProviderProfile> {
    const creds = this.creds(provider);
    const spec = SPECS[provider];
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      redirect_uri: this.redirectUri(provider),
      grant_type: 'authorization_code',
    });
    if (spec.pkce) body.set('code_verifier', saved.verifier);
    const res = await fetch(spec.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`Troca de código ${provider} falhou: ${res.status} ${await res.text()}`);
      throw new OAuthError('falhou');
    }
    const { access_token } = (await res.json()) as { access_token?: string };
    if (!access_token) throw new OAuthError('falhou');
    const profile = await spec.profile(access_token);
    profile.email = profile.email.trim().toLowerCase();
    return profile;
  }

  private creds(provider: AuthProvider) {
    const c = this.config.get<AppConfig['oauth']>('oauth')![provider];
    if (!c) throw new BadRequestException('Login com esse provedor não está configurado');
    return c;
  }
}
