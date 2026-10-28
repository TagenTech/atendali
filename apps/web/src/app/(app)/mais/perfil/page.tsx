'use client';

import { AUTH_PROVIDER_LABEL, formatCpf, isValidCpf, isValidPhone, normalizeCpf } from '@agendei/contracts';
import { BadgeCheck, IdCard, MailWarning, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { FormTopBar, StickyActions, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { completeProfile, resendVerification } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { celebrate } from '@/lib/celebrate';
import { haptic } from '@/lib/utils';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function PerfilPage() {
  const back = useBack('/mais');
  const { user, setUser } = useAuth();
  const [name, setName] = React.useState(user?.name ?? '');
  const [cpf, setCpf] = React.useState('');
  const [phone, setPhone] = React.useState(user?.phone ?? '');
  const [city, setCity] = React.useState(user?.city ?? '');
  const [uf, setUf] = React.useState(user?.state ?? '');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const done = !!user?.profileComplete;
  const editingCpf = !done || cpf.length > 0;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!/\S+\s+\S+/.test(name.trim())) e.name = 'Informe nome e sobrenome';
    if (editingCpf && !isValidCpf(cpf)) e.cpf = 'CPF inválido — confira os números';
    if (!isValidPhone(phone)) e.phone = 'Celular inválido — use DDD + número, ou + e o código do país';
    setErrors(e);
    if (Object.keys(e).length) {
      haptic([30, 40, 30]);
      return;
    }
    if (done && !editingCpf) {
      toast('Para alterar os dados, informe o CPF novamente.');
      setErrors({ cpf: 'Confirme seu CPF para salvar' });
      return;
    }
    setSaving(true);
    try {
      const t = await completeProfile({ name: name.trim(), cpf: normalizeCpf(cpf), phone, city: city.trim() || null, state: uf || null });
      setUser(t);
      haptic([15, 60, 25]);
      if (!done) celebrate();
      toast.success(done ? 'Dados atualizados ✨' : 'Cadastro finalizado! Obrigado 💜');
      back();
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormTopBar onBack={back} title={done ? 'Meu perfil' : 'Finalizar cadastro'} />
      <div className="space-y-5 px-5">
        {done ? (
          <Card className="flex items-center gap-3 bg-success-soft">
            <BadgeCheck className="size-6 shrink-0 text-success-soft-foreground" />
            <p className="text-sm text-success-soft-foreground">Cadastro completo. CPF {user?.cpfMasked}.</p>
          </Card>
        ) : (
          <Card className="space-y-1 bg-primary-soft">
            <p className="font-display font-extrabold text-primary-soft-foreground">Falta pouco! 🌷</p>
            <p className="text-sm text-primary-soft-foreground">
              Precisamos do seu nome completo, CPF e celular para identificar o titular da conta. Seus dados ficam protegidos.
            </p>
          </Card>
        )}

        <Card className="space-y-4">
          <Field label="Nome completo" htmlFor="pf-name" error={errors.name}>
            <Input id="pf-name" autoComplete="name" autoCapitalize="words" icon={<User />} value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
          </Field>
          <Field label="CPF" htmlFor="pf-cpf" error={errors.cpf} hint={done && !cpf ? `Atual: ${user?.cpfMasked} — preencha só se quiser alterar` : undefined}>
            <Input
              id="pf-cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              icon={<IdCard />}
              value={formatCpf(cpf)}
              onChange={(e) => setCpf(normalizeCpf(e.target.value))}
              invalid={!!errors.cpf}
            />
          </Field>
          <Field label="Celular (WhatsApp)" htmlFor="pf-phone" hint="Fora do Brasil? Comece com + e o código do país" error={errors.phone}>
            <PhoneInput id="pf-phone" icon={<Phone />} value={phone} onChange={setPhone} invalid={!!errors.phone} />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <Field label="Cidade" htmlFor="pf-city" className="min-w-0">
              <Input id="pf-city" icon={<MapPin />} value={city} onChange={(e) => setCity(e.target.value)} placeholder="opcional" />
            </Field>
            <Field label="UF" htmlFor="pf-uf">
              <select
                id="pf-uf"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3 text-base outline-none focus:border-primary"
              >
                <option value="">—</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Acesso</h2>
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              {user?.emailVerified ? <ShieldCheck className="size-5 text-success" /> : <MailWarning className="size-5 text-warning" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user?.email}</p>
                <p className="text-sm text-muted-foreground">{user?.emailVerified ? 'E-mail confirmado' : 'E-mail ainda não confirmado'}</p>
              </div>
              {!user?.emailVerified ? (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={async () => {
                    await resendVerification().catch(() => undefined);
                    toast('Link enviado — confira sua caixa de entrada 💌');
                  }}
                >
                  Reenviar
                </Button>
              ) : null}
            </div>
            {user?.providers.length ? (
              <p className="text-sm text-muted-foreground">
                Conectado com: {user.providers.map((p) => AUTH_PROVIDER_LABEL[p]).join(', ')}
              </p>
            ) : null}
          </Card>
        </section>
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Usamos o CPF só para identificar o titular e, no futuro, emitir a cobrança da assinatura. Veja a{' '}
          <a href="/privacidade" target="_blank" className="underline">
            Política de privacidade
          </a>
          .
        </p>
      </div>
      <StickyActions>
        <Button block size="lg" loading={saving} onClick={save}>
          {done ? 'Salvar' : 'Finalizar cadastro'}
        </Button>
      </StickyActions>
    </>
  );
}
