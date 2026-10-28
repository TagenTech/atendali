'use client';

import { ROLE_INFO, SEGMENT_PRESETS } from '@agendei/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorText } from '@/lib/api/client';
import * as orgApi from '@/lib/api/org';
import { useAuth } from '@/lib/auth';
import { celebrate } from '@/lib/celebrate';
import { useActivateOrg } from '@/lib/org';

function Invite() {
  const token = useSearchParams().get('token') ?? '';
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const activate = useActivateOrg();
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const info = useQuery({ queryKey: ['invite', token], queryFn: () => orgApi.inviteInfo(token), enabled: !!token, retry: false });
  const back = encodeURIComponent(`/convite?token=${token}`);

  if (!token || info.isError) {
    return (
      <AuthLayout title="Convite inválido" subtitle={info.error ? errorText(info.error) : 'O link está incompleto.'}>
        <Button asChild block size="lg">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </AuthLayout>
    );
  }
  if (!info.data || status === 'loading') {
    return <AuthLayout title="Abrindo convite…">{null}</AuthLayout>;
  }

  const { organizationName, segment, role, email } = info.data;
  const accept = async () => {
    setJoining(true);
    setError(null);
    try {
      const org = await orgApi.acceptInvite({ token });
      await activate(org.id);
      celebrate();
      toast.success(`Bem-vindo(a) à equipe de ${org.name}! 🎉`);
      router.replace('/inicio');
    } catch (err) {
      setError(errorText(err, 'Não foi possível aceitar agora'));
      setJoining(false);
    }
  };

  return (
    <AuthLayout title="Você foi convidado(a)!" subtitle={`Para a equipe de ${organizationName}`}>
      <div className="space-y-4">
        <Card className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">{SEGMENT_PRESETS[segment].label}</p>
          <p className="font-display text-xl font-extrabold">{organizationName}</p>
          <p className="text-sm">
            Perfil: <strong>{ROLE_INFO[role].label}</strong>
          </p>
          <p className="text-xs text-muted-foreground">Convite para {email}</p>
        </Card>
        {error ? (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
            {error}
          </p>
        ) : null}
        {status === 'authenticated' ? (
          <>
            <Button block size="lg" loading={joining} onClick={accept}>
              Entrar na equipe
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Você está como {user?.email}.{' '}
              <button type="button" className="font-bold text-primary" onClick={() => void logout()}>
                Trocar de conta
              </button>
            </p>
          </>
        ) : (
          <>
            <Button asChild block size="lg">
              <Link href={`/cadastro?next=${back}`}>Criar minha conta</Link>
            </Button>
            <Button asChild block size="lg" variant="outline">
              <Link href={`/login?next=${back}`}>Já tenho conta</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">Use o mesmo e-mail que recebeu o convite.</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default function ConvitePage() {
  return (
    <React.Suspense>
      <Invite />
    </React.Suspense>
  );
}
