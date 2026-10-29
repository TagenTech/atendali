import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from './auth';
import { setAccessToken } from './client';

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const authHeader = (fetchMock: ReturnType<typeof vi.fn>, i: number) => new Headers((fetchMock.mock.calls[i][1] as RequestInit).headers).get('authorization');

describe('api/auth', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
  });

  it('login guarda o token; com 2FA pendente não guarda nada', async () => {
    fetchMock.mockImplementation(async () => ok({}));
    fetchMock.mockResolvedValueOnce(ok({ accessToken: 'tok', user: { id: 'u' } }));
    await auth.login({ email: 'a@x.com', password: 'senha' });
    await auth.getMe();
    expect(authHeader(fetchMock, 1)).toBe('Bearer tok');

    setAccessToken(null);
    fetchMock.mockResolvedValueOnce(ok({ mfaRequired: true, mfaToken: 'tic' }));
    const challenge = await auth.login({ email: 'a@x.com', password: 'senha' });
    expect(challenge).toMatchObject({ mfaRequired: true });
    await auth.getMe();
    expect(authHeader(fetchMock, 3)).toBeNull();
  });

  it('verifyMfa e register guardam o token da sessão nova', async () => {
    fetchMock.mockResolvedValue(ok({ accessToken: 'tok2', user: {} }));
    await auth.verifyMfa('tic', '123456');
    await auth.getMe();
    expect(authHeader(fetchMock, 1)).toBe('Bearer tok2');
    setAccessToken(null);
    fetchMock.mockResolvedValue(ok({ accessToken: 'tok3', user: {} }));
    await auth.register({ name: 'A', email: 'a@x.com', password: 'senha-forte-123', acceptTerms: true });
    await auth.getMe();
    expect(authHeader(fetchMock, 3)).toBe('Bearer tok3');
  });

  it('logout e excluir conta esquecem o token, mesmo se a chamada falhar', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 })).mockResolvedValueOnce(ok());
    await expect(auth.logout()).rejects.toBeTruthy();
    await auth.getMe();
    expect(authHeader(fetchMock, 1)).toBeNull();
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());
    await auth.deleteAccount({ confirmEmail: 'a@x.com', password: 'x' });
    await auth.getMe();
    expect(authHeader(fetchMock, 3)).toBeNull();
  });

  it('as demais rotas chamam o caminho certo; oauthUrl vira navegação', async () => {
    fetchMock.mockImplementation(async () => ok());
    const calls: [string, () => Promise<unknown>][] = [
      ['/auth/sessions', () => auth.sessions()],
      ['/auth/sessions/s1', () => auth.revokeSession('s1')],
      ['/auth/sessions/revoke-others', () => auth.revokeOtherSessions()],
      ['/auth/activity', () => auth.activity()],
      ['/auth/mfa/setup', () => auth.mfaSetup()],
      ['/auth/mfa/enable', () => auth.mfaEnable('1')],
      ['/auth/mfa/disable', () => auth.mfaDisable('1')],
      ['/auth/mfa/recovery-codes', () => auth.mfaRecoveryCodes('1')],
      ['/auth/providers', () => auth.providers()],
      ['/auth/forgot-password', () => auth.forgotPassword('a@x.com')],
      ['/auth/reset-password', () => auth.resetPassword('t', 'senha')],
      ['/auth/verify-email', () => auth.verifyEmail('t')],
      ['/auth/resend-verification', () => auth.resendVerification()],
      ['/auth/password', () => auth.changePassword({ newPassword: 'x' })],
      ['/me/profile', () => auth.completeProfile({} as never)],
    ];
    for (const [path, run] of calls) {
      fetchMock.mockClear();
      await run();
      expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1${path}`);
    }
    expect(auth.oauthUrl('google')).toBe('/api/v1/auth/oauth/google');
  });
});
