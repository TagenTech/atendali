'use client';

import type { MfaSetupDto } from '@skedulei/contracts';
import { Copy, Download, ExternalLink, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import * as React from 'react';
import { toast } from 'sonner';
import { MfaCodeForm } from '@/components/auth/mfa-code-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { mfaDisable, mfaEnable, mfaRecoveryCodes, mfaSetup } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/utils';

const errMsg = (e: unknown) => (e instanceof ApiError ? (e.details?.[0] ?? e.message) : 'Algo deu errado');

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Códigos de recuperação do Skedulei (cada um funciona uma vez):\n\n${codes.join('\n')}\n`;
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Guarde estes códigos num lugar seguro (gerenciador de senhas ou papel). Se perder o celular, eles são o único jeito de
        entrar. <strong>Eles não aparecem de novo.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-4 font-mono text-sm tabular">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="soft"
          onClick={async () => {
            await navigator.clipboard?.writeText(text);
            toast('Códigos copiados 📋');
          }}
        >
          <Copy /> Copiar
        </Button>
        <Button
          variant="soft"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            Object.assign(document.createElement('a'), { href: url, download: 'skedulei-codigos-de-recuperacao.txt' }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download /> Baixar
        </Button>
      </div>
      <Button block size="lg" onClick={onDone}>
        Já guardei
      </Button>
    </div>
  );
}

export function MfaSection() {
  const { user, reloadUser } = useAuth();
  const [step, setStep] = React.useState<'idle' | 'setup' | 'codes' | 'disable' | 'regen'>('idle');
  const [setup, setSetup] = React.useState<MfaSetupDto | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [codes, setCodes] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const enabled = !!user?.mfaEnabled;

  const start = async () => {
    setError(null);
    try {
      const s = await mfaSetup();
      setSetup(s);
      setQr(await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 220, color: { dark: '#2d2640', light: '#ffffff' } }));
      setStep('setup');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      haptic([30, 40, 30]);
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-12 place-items-center rounded-2xl ${enabled ? 'bg-success-soft text-success-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'}`}>
          {enabled ? <ShieldCheck className="size-6" /> : <ShieldOff className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold">Verificação em duas etapas</p>
          <p className="text-sm text-muted-foreground">
            {enabled ? 'Ativa — além da senha, pedimos o código do app.' : 'Proteja a conta mesmo se alguém descobrir sua senha.'}
          </p>
        </div>
      </div>
      {enabled ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => (setError(null), setStep('regen'))}>
            Novos códigos
          </Button>
          <Button variant="danger" onClick={() => (setError(null), setStep('disable'))}>
            Desativar
          </Button>
        </div>
      ) : (
        <Button block onClick={start}>
          Ativar
        </Button>
      )}

      <Sheet
        open={step !== 'idle'}
        onOpenChange={(o) => !o && step !== 'codes' && setStep('idle')}
        title={
          step === 'setup'
            ? 'Ativar verificação em duas etapas'
            : step === 'codes'
              ? 'Códigos de recuperação'
              : step === 'disable'
                ? 'Desativar verificação'
                : 'Gerar novos códigos'
        }
      >
        {step === 'setup' && setup ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Instale um app autenticador (Google Authenticator, Microsoft Authenticator, Authy…).</li>
              <li>No celular, toque em &quot;Abrir no app&quot;; no computador, leia o QR com o celular.</li>
              <li>Digite o código de 6 números que aparecer.</li>
            </ol>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code para o app autenticador" className="mx-auto size-48 rounded-2xl border border-border bg-white p-2" />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="soft">
                <a href={setup.otpauthUrl}>
                  <ExternalLink /> Abrir no app
                </a>
              </Button>
              <Button
                variant="soft"
                onClick={async () => {
                  await navigator.clipboard?.writeText(setup.secret);
                  toast('Chave copiada 📋');
                }}
              >
                <Copy /> Copiar chave
              </Button>
            </div>
            <p className="break-all rounded-xl bg-muted px-3 py-2 text-center font-mono text-xs">{setup.secret.match(/.{1,4}/g)?.join(' ')}</p>
            <MfaCodeForm
              allowRecovery={false}
              loading={loading}
              error={error}
              submitLabel="Ativar"
              onSubmit={(code) =>
                run(async () => {
                  const r = await mfaEnable(code);
                  setCodes(r.codes);
                  setStep('codes');
                  haptic([15, 60, 25]);
                  await reloadUser();
                })
              }
            />
          </div>
        ) : step === 'codes' ? (
          <RecoveryCodes
            codes={codes}
            onDone={() => {
              setCodes([]);
              setStep('idle');
              toast.success('Verificação em duas etapas ativa 🔐');
            }}
          />
        ) : step === 'disable' ? (
          <div className="space-y-4">
            <p className="text-sm">Para desativar, confirme com o código do app (ou um código de recuperação).</p>
            <MfaCodeForm
              loading={loading}
              error={error}
              submitLabel="Desativar"
              onSubmit={(code) =>
                run(async () => {
                  await mfaDisable(code);
                  await reloadUser();
                  setStep('idle');
                  toast('Verificação em duas etapas desativada');
                })
              }
            />
          </div>
        ) : step === 'regen' ? (
          <div className="space-y-4">
            <p className="text-sm">Os códigos antigos param de funcionar. Confirme com o código do app.</p>
            <MfaCodeForm
              allowRecovery={false}
              loading={loading}
              error={error}
              submitLabel="Gerar novos"
              onSubmit={(code) =>
                run(async () => {
                  const r = await mfaRecoveryCodes(code);
                  setCodes(r.codes);
                  setStep('codes');
                })
              }
            />
          </div>
        ) : null}
      </Sheet>
    </Card>
  );
}
