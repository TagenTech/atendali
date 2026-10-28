import {
  isMfaChallenge,
  type DeleteAccountRequest,
  type LoginResult,
  type MfaSetupDto,
  type RecoveryCodesDto,
  type SecurityEventDto,
  type SessionDto,
} from '@skedulei/contracts';
import type {
  AuthProvidersDto,
  AuthResponse,
  ChangePasswordRequest,
  CompleteProfileRequest,
  LoginRequest,
  RegisterRequest,
  UserDto,
} from '@skedulei/contracts';
import { api, setAccessToken } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export async function login(body: LoginRequest): Promise<LoginResult> {
  const data = await api<LoginResult>('/auth/login', { method: 'POST', ...json(body) });
  if (!isMfaChallenge(data)) setAccessToken(data.accessToken);
  return data;
}

export async function verifyMfa(mfaToken: string, code: string): Promise<AuthResponse> {
  const data = await api<AuthResponse>('/auth/mfa/verify', { method: 'POST', ...json({ mfaToken, code }) });
  setAccessToken(data.accessToken);
  return data;
}

export const sessions = () => api<SessionDto[]>('/auth/sessions');
export const revokeSession = (id: string) => api<void>(`/auth/sessions/${id}`, { method: 'DELETE' });
export const revokeOtherSessions = () => api<void>('/auth/sessions/revoke-others', { method: 'POST' });
export const activity = () => api<SecurityEventDto[]>('/auth/activity');
export const mfaSetup = () => api<MfaSetupDto>('/auth/mfa/setup', { method: 'POST' });
export const mfaEnable = (code: string) => api<RecoveryCodesDto>('/auth/mfa/enable', { method: 'POST', ...json({ code }) });
export const mfaDisable = (code: string) => api<void>('/auth/mfa/disable', { method: 'POST', ...json({ code }) });
export const mfaRecoveryCodes = (code: string) =>
  api<RecoveryCodesDto>('/auth/mfa/recovery-codes', { method: 'POST', ...json({ code }) });
export async function deleteAccount(body: DeleteAccountRequest): Promise<void> {
  await api<void>('/auth/delete-account', { method: 'POST', ...json(body) });
  setAccessToken(null);
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const data = await api<AuthResponse>('/auth/register', { method: 'POST', ...json(body) });
  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api<void>('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

export const providers = () => api<AuthProvidersDto>('/auth/providers');
export const forgotPassword = (email: string) => api<void>('/auth/forgot-password', { method: 'POST', ...json({ email }) });
export const resetPassword = (token: string, password: string) =>
  api<void>('/auth/reset-password', { method: 'POST', ...json({ token, password }) });
export const verifyEmail = (token: string) => api<void>('/auth/verify-email', { method: 'POST', ...json({ token }) });
export const resendVerification = () => api<void>('/auth/resend-verification', { method: 'POST' });
export const changePassword = (body: Partial<ChangePasswordRequest>) =>
  api<void>('/auth/password', { method: 'PATCH', ...json(body) });
export const getMe = () => api<UserDto>('/me');
export const completeProfile = (body: CompleteProfileRequest) =>
  api<UserDto>('/me/profile', { method: 'PATCH', ...json(body) });

/** Login social: navegação de página inteira (o provedor devolve para a API). */
export const oauthUrl = (provider: string) => `/api/v1/auth/oauth/${provider}`;
