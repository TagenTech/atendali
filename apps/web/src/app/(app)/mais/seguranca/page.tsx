'use client';

import { KeyRound } from 'lucide-react';
import * as React from 'react';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { DeleteAccountSection } from '@/components/security/delete-account';
import { MfaSection } from '@/components/security/mfa-section';
import { ActivitySection, SessionsSection } from '@/components/security/sessions-section';
import { ChangePasswordSheet } from '@/components/settings/change-password-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

export default function SegurancaPage() {
  const back = useBack('/mais');
  const { user } = useAuth();
  const [pw, setPw] = React.useState(false);
  return (
    <>
      <FormTopBar onBack={back} title="Segurança da conta" />
      <div className="space-y-5 px-5 pb-8">
        <MfaSection />
        <Card className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <KeyRound className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold">Senha</p>
            <p className="text-sm text-muted-foreground">{user?.hasPassword ? 'Trocar encerra os outros aparelhos.' : 'Você entra só pelo login social.'}</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => setPw(true)}>
            {user?.hasPassword ? 'Alterar' : 'Criar'}
          </Button>
        </Card>
        <SessionsSection />
        <ActivitySection />
        <DeleteAccountSection />
      </div>
      <ChangePasswordSheet open={pw} onOpenChange={setPw} />
    </>
  );
}
