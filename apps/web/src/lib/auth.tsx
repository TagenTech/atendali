'use client';

import { isMfaChallenge, type LoginRequest, type RegisterRequest, type UserDto } from '@agendei/contracts';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import * as authApi from './api/auth';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from './api/client';

/** `unavailable` = não deu para falar com o servidor ao restaurar a sessão (não é o mesmo que deslogado). */
type Status = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

interface AuthContextValue {
  status: Status;
  user: UserDto | null;
  /** Devolve o token de 2FA quando a conta exige o segundo passo. */
  login: (body: LoginRequest) => Promise<{ mfaToken?: string }>;
  completeMfa: (mfaToken: string, code: string) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  /** Recarrega os dados da conta (após confirmar e-mail, finalizar cadastro…). */
  reloadUser: () => Promise<void>;
  logout: () => Promise<void>;
  /** Atualiza os dados da conta em memória (após salvar ajustes). */
  setUser: (t: UserDto) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const PUBLIC_ENTRY = ['/login', '/login/2fa', '/cadastro', '/esqueci-senha', '/redefinir-senha'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>('loading');
  const [user, setUser] = React.useState<UserDto | null>(null);

  React.useEffect(() => {
    // Restaura a sessão a partir do cookie httpOnly de refresh. Nas telas de entrada o proxy já
    // garantiu que não há cookie, então não vale a requisição.
    const restore = PUBLIC_ENTRY.includes(window.location.pathname) ? Promise.resolve(null) : refreshSession();
    restore.then(
      (session) => {
        setUser(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'anonymous');
      },
      () => setStatus('unavailable'),
    );
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('anonymous');
      router.replace('/login');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (body) => {
        const data = await authApi.login(body);
        if (isMfaChallenge(data)) return { mfaToken: data.mfaToken };
        setUser(data.user);
        setStatus('authenticated');
        return {};
      },
      completeMfa: async (mfaToken, code) => {
        const data = await authApi.verifyMfa(mfaToken, code);
        setUser(data.user);
        setStatus('authenticated');
      },
      register: async (body) => {
        const data = await authApi.register(body);
        setUser(data.user);
        setStatus('authenticated');
      },
      reloadUser: async () => {
        setUser(await authApi.getMe());
      },
      logout: async () => {
        await authApi.logout().catch(() => setAccessToken(null));
        setUser(null);
        setStatus('anonymous');
        router.replace('/login');
      },
      setUser,
    }),
    [status, user, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
