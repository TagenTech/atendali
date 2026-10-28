'use client';

import { AUTH_PROVIDER_LABEL, AuthProvider } from '@agendei/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import { oauthUrl, providers } from '@/lib/api/auth';

function Logo({ provider }: { provider: AuthProvider }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  }
  if (provider === 'microsoft') {
    return (
      <svg viewBox="0 0 23 23" className="size-5" aria-hidden>
        <path fill="#f25022" d="M1 1h10v10H1z" />
        <path fill="#7fba00" d="M12 1h10v10H12z" />
        <path fill="#00a4ef" d="M1 12h10v10H1z" />
        <path fill="#ffb900" d="M12 12h10v10H12z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
    </svg>
  );
}

const ALL: AuthProvider[] = [AuthProvider.GOOGLE, AuthProvider.MICROSOFT, AuthProvider.FACEBOOK];
const NAME: Record<AuthProvider, string> = { google: 'Google', microsoft: 'Outlook', facebook: 'Facebook' };

/**
 * Botões de login social. Em produção só aparecem os provedores configurados no servidor;
 * em desenvolvimento os três aparecem, e os sem credencial explicam o que falta.
 */
export function SocialButtons({ label = 'Entrar' }: { label?: string }) {
  const { data } = useQuery({ queryKey: ['auth', 'providers'], queryFn: providers, staleTime: 5 * 60_000 });
  const [going, setGoing] = React.useState<string | null>(null);
  if (!data) return <div className="h-[11.5rem]" aria-hidden />;
  const enabled = new Set(data.providers);
  const list = process.env.NODE_ENV === 'production' ? data.providers : ALL;
  if (!list.length) return null;
  const cls =
    'flex h-12 w-full items-center justify-center gap-3 rounded-2xl border-2 border-input bg-card font-semibold transition-colors hover:bg-muted active:scale-[0.98]';
  return (
    <div className="space-y-2.5">
      {list.map((p) =>
        enabled.has(p) ? (
          <a key={p} href={oauthUrl(p)} onClick={() => setGoing(p)} aria-busy={going === p || undefined} className={cls}>
            <Logo provider={p} />
            {going === p ? 'Abrindo…' : `${label} com ${NAME[p]}`}
          </a>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() =>
              toast(`Login com ${AUTH_PROVIDER_LABEL[p]} ainda não configurado`, {
                description: `Coloque ${p.toUpperCase()}_CLIENT_ID e ${p.toUpperCase()}_CLIENT_SECRET no apps/api/.env (veja docs/AUTENTICACAO.md).`,
              })
            }
            className={`${cls} opacity-60`}
          >
            <Logo provider={p} />
            {`${label} com ${NAME[p]}`}
          </button>
        ),
      )}
      <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export function useSignupEnabled() {
  const { data } = useQuery({ queryKey: ['auth', 'providers'], queryFn: providers, staleTime: 5 * 60_000 });
  return data?.signupEnabled ?? true;
}
