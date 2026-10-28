'use client';

import {
  canAssignRole,
  defaultBusinessHours,
  MEMBER_COLOR_COUNT,
  MemberStatus,
  Role,
  ROLE_INFO,
  ROLES,
  validateBusinessHours,
  type BusinessHours,
  type MemberDto,
} from '@skedulei/contracts';
import { Check, Mail, Send } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PercentInput } from '@/components/ui/percent-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useRemoveMember, useResendInvite, useSaveMember, useUnits } from '@/lib/queries/org';
import { BusinessHoursEditor } from './business-hours-editor';
import { cn } from '@/lib/utils';

/** Cor da pessoa na agenda (tokens --pro-1…8). */
export const memberColor = (n: number) => ({ background: `var(--pro-${n})`, color: `var(--pro-${n}-fg)` });

export function MemberSheet({ open, onOpenChange, member }: { open: boolean; onOpenChange: (v: boolean) => void; member: MemberDto | null }) {
  const { org } = useOrg();
  const save = useSaveMember();
  const remove = useRemoveMember();
  const resend = useResendInvite();
  const myRole = org.me.role;
  const hasAccess = member?.status === MemberStatus.ATIVO;

  const [name, setName] = React.useState(member?.name ?? '');
  const [email, setEmail] = React.useState(member?.email ?? '');
  const [phone, setPhone] = React.useState(member?.phone ?? '');
  const [role, setRole] = React.useState<Role>(member?.role ?? Role.PROFISSIONAL);
  const [bookable, setBookable] = React.useState(member?.bookable ?? true);
  const [color, setColor] = React.useState(member?.color ?? 1);
  const unitHours = useUnits().data?.[0]?.businessHours;
  const [commission, setCommission] = React.useState<number | null>(member?.commissionBps ?? null);
  const [ownHours, setOwnHours] = React.useState<BusinessHours | null>(member?.workingHours ?? null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  // Sem e-mail a pessoa não entra no app: só faz sentido como profissional que atende.
  const noEmail = !hasAccess && !email.trim();
  const roles = ROLES.filter((r) => canAssignRole(myRole, r) || r === member?.role);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Informe o nome';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'E-mail inválido';
    if (noEmail && role !== Role.PROFISSIONAL) errs.email = 'Para dar esse acesso, informe o e-mail da pessoa';
    const hoursProblem = ownHours ? validateBusinessHours(ownHours) : null;
    if (hoursProblem) errs.hours = hoursProblem;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: member?.id,
        body: {
          name: name.trim(),
          ...(hasAccess ? {} : { email: email.trim() || null }),
          phone: phone || null,
          role,
          bookable: noEmail ? true : bookable,
          color,
          workingHours: ownHours,
          commissionBps: commission,
        },
      });
      const invited = !hasAccess && email.trim() && email.trim().toLowerCase() !== member?.email;
      toast.success(invited ? `Convite enviado para ${email.trim()} 💌` : member ? 'Alterações salvas' : 'Pessoa adicionada à equipe');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={member ? member.name : 'Adicionar à equipe'}
      description={member ? undefined : 'Com e-mail, a pessoa recebe um convite para entrar no app.'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="m-name" error={errors.name}>
          <Input id="m-name" value={name} maxLength={120} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} autoFocus={!member} />
        </Field>
        <Field
          label="E-mail"
          htmlFor="m-email"
          error={errors.email}
          hint={hasAccess ? 'É o e-mail da conta da pessoa.' : 'Opcional para profissionais que só aparecem na agenda.'}
        >
          <Input
            id="m-email"
            type="email"
            icon={<Mail />}
            value={email}
            disabled={hasAccess}
            invalid={!!errors.email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Celular (opcional)" htmlFor="m-phone">
          <PhoneInput id="m-phone" value={phone} onChange={setPhone} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-semibold">Perfil de acesso</legend>
          <div className="space-y-2" role="radiogroup">
            {roles.map((r) => {
              const disabled = (noEmail && r !== Role.PROFISSIONAL) || !canAssignRole(myRole, r);
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  disabled={disabled}
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors disabled:opacity-45',
                    role === r ? 'border-primary bg-primary-soft' : 'border-input bg-card hover:bg-muted',
                  )}
                >
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', role === r ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                    {role === r ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span>
                    <span className="block font-semibold">{ROLE_INFO[r].label}</span>
                    <span className="block text-sm text-muted-foreground">{ROLE_INFO[r].description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {noEmail ? null : (
          <SwitchRow id="m-bookable" checked={bookable} onCheckedChange={setBookable} title="Atende clientes" description="Tem coluna própria na agenda" />
        )}

        {noEmail || bookable ? (
          <Field label="Comissão padrão" htmlFor="m-commission" hint="Vale quando o serviço não tem comissão própria. Vazio = sem comissão.">
            <PercentInput id="m-commission" value={commission} onChange={setCommission} />
          </Field>
        ) : null}

        {noEmail || bookable ? (
          <section className="space-y-2">
            <SwitchRow
              id="m-own-hours"
              checked={!!ownHours}
              onCheckedChange={(v) => setOwnHours(v ? (unitHours ?? defaultBusinessHours()).map((d) => d.map((r) => ({ ...r }))) : null)}
              title="Horário próprio"
              description="Desligado, segue o horário da unidade. Ligado, vale só dentro do horário da unidade."
            />
            {ownHours ? <BusinessHoursEditor value={ownHours} onChange={setOwnHours} /> : null}
            {errors.hours ? (
              <p role="alert" className="pl-1 text-sm font-medium text-danger">
                {errors.hours}
              </p>
            ) : null}
          </section>
        ) : null}

        <fieldset>
          <legend className="mb-2 pl-1 text-sm font-semibold">Cor na agenda</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MEMBER_COLOR_COUNT }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Cor ${n}`}
                aria-pressed={color === n}
                onClick={() => setColor(n)}
                style={memberColor(n)}
                className={cn('grid size-10 place-items-center rounded-xl ring-offset-2 ring-offset-card transition', color === n && 'ring-2 ring-primary')}
              >
                {color === n ? <Check className="size-4" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          {member?.status === MemberStatus.CONVIDADO ? (
            <Button
              type="button"
              variant="soft"
              loading={resend.isPending}
              onClick={async () => {
                try {
                  await resend.mutateAsync(member.id);
                  toast.success('Convite reenviado');
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              <Send /> Reenviar convite
            </Button>
          ) : null}
          {member && !member.isMe && canAssignRole(myRole, member.role) ? (
            <Button
              type="button"
              variant="danger"
              loading={remove.isPending}
              onClick={async () => {
                if (!confirmRemove) return setConfirmRemove(true);
                try {
                  await remove.mutateAsync(member.id);
                  toast.success(`${member.name} saiu da equipe`);
                  onOpenChange(false);
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              {confirmRemove ? 'Confirmar remoção' : 'Remover'}
            </Button>
          ) : null}
          <Button type="submit" className="flex-1" loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
