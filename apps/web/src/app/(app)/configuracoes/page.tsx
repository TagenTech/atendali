'use client';

import {
  describeDay,
  Feature as FeatureKey,
  FEATURE_INFO,
  FEATURES,
  HEALTH_FEATURES,
  isFeatureAvailable,
  PAYMENT_METHOD_LABEL,
  Permission,
  SEGMENT_PRESETS,
  validateLoyalty,
  WEEKDAY_SHORT,
  type CommissionBase,
  type Feature,
  type PaymentMethodConfig,
  type UnitDto,
} from '@skedulei/contracts';
import { Link2, MapPin, Plus, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { SegmentIcon } from '@/components/layout/segment-icon';
import { TemplatesEditor } from '@/components/clinico/templates-editor';
import { BrandingEditor } from '@/components/org/branding-editor';
import { UnitSheet } from '@/components/org/unit-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { PercentInput } from '@/components/ui/percent-input';
import { ToggleTrack } from '@/components/ui/toggle-track';
import { PhoneInput } from '@/components/ui/phone-input';
import { SwitchRow } from '@/components/ui/switch-row';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useUnits, useUpdateOrganization } from '@/lib/queries/org';
import { cn } from '@/lib/utils';

function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-8">
      <div className="flex items-start justify-between gap-3 xl:block">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="xl:mt-3">{action}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function BusinessInfo() {
  const { org } = useOrg();
  const update = useUpdateOrganization();
  const [name, setName] = React.useState(org.name);
  const [phone, setPhone] = React.useState(org.phone ?? '');
  const [document, setDocument] = React.useState(org.document ?? '');
  const dirty = name !== org.name || phone !== (org.phone ?? '') || document !== (org.document ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim(), phone: phone || null, document: document.replace(/\D/g, '') || null });
      toast.success('Dados do negócio salvos');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
          <SegmentIcon segment={org.segment} className="size-5 text-primary" />
          <span className="text-sm">
            <span className="font-semibold">{SEGMENT_PRESETS[org.segment].label}</span>
            <span className="text-muted-foreground"> · página pública: </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              <Link2 className="size-3.5" /> skedulei.app/{org.slug}
            </span>
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do negócio" htmlFor="o-name">
            <Input id="o-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Telefone / WhatsApp" htmlFor="o-phone">
            <PhoneInput id="o-phone" value={phone} onChange={setPhone} />
          </Field>
          <Field label="CNPJ ou CPF" htmlFor="o-doc" hint="Usado depois nas notas fiscais e recibos">
            <Input id="o-doc" inputMode="numeric" value={document} maxLength={18} onChange={(e) => setDocument(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || !name.trim()} loading={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Opção futura: sinal/taxa ao agendar online. Fica visível, mas desligada, até existir o pagamento online (Fase 4). */
function BookingFee() {
  return (
    <Card>
      <SwitchRow
        id="booking-fee"
        checked={false}
        onCheckedChange={() => undefined}
        disabled
        badge="Em breve"
        title="Cobrar taxa de agendamento"
        description="O cliente paga um sinal pelo Pix ao marcar na página online, e o valor abate na comanda. Disponível quando o pagamento online chegar."
      />
    </Card>
  );
}

function Loyalty() {
  const { org } = useOrg();
  const update = useUpdateOrganization();
  const rule = org.loyalty;
  const [enabled, setEnabled] = React.useState(rule.enabled);
  const [perReal, setPerReal] = React.useState(String(rule.pointsPerReal));
  const [redeemPoints, setRedeemPoints] = React.useState(String(rule.redeemPoints));
  const [redeemValue, setRedeemValue] = React.useState<number | null>(rule.redeemValueCents);
  const next = { enabled, pointsPerReal: Math.trunc(Number(perReal)), redeemPoints: Math.trunc(Number(redeemPoints)), redeemValueCents: redeemValue ?? 0 };
  const dirty = JSON.stringify(next) !== JSON.stringify(rule);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateLoyalty(next);
    if (problem) return toast.error(problem);
    try {
      await update.mutateAsync({ loyalty: next });
      toast.success('Regras de pontos salvas');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <SwitchRow id="loy-on" checked={enabled} onCheckedChange={setEnabled} title="Programa de pontos" description="Quem paga acumula pontos e troca por desconto na comanda" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pontos por R$ 1,00" htmlFor="loy-per">
            <Input id="loy-per" type="number" inputMode="numeric" min={1} max={100} value={perReal} onChange={(e) => setPerReal(e.target.value)} />
          </Field>
          <Field label="Pontos por resgate" htmlFor="loy-points">
            <Input id="loy-points" type="number" inputMode="numeric" min={1} value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} />
          </Field>
          <Field label="Desconto por resgate" htmlFor="loy-value">
            <MoneyInput id="loy-value" value={redeemValue} onChange={setRedeemValue} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty} loading={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Modules() {
  const { org } = useOrg();
  const update = useUpdateOrganization();
  const toggle = async (f: Feature) => {
    const on = org.features.includes(f);
    try {
      await update.mutateAsync({ features: on ? org.features.filter((x) => x !== f) : [...org.features, f] });
      toast.success(`${FEATURE_INFO[f].label} ${on ? 'desligado' : 'ligado'}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {FEATURES.map((f) => {
        const on = org.features.includes(f);
        return (
          <button
            key={f}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={update.isPending || !isFeatureAvailable(f)}
            onClick={() => toggle(f)}
            className={cn(
              'flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors',
              on ? 'border-primary bg-primary-soft' : 'border-input bg-card hover:bg-muted',
              !isFeatureAvailable(f) && 'cursor-not-allowed opacity-60 hover:bg-card',
            )}
          >
            <ToggleTrack on={on} className="mt-0.5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">
                {FEATURE_INFO[f].label}
                {!isFeatureAvailable(f) ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Em breve</span> : null}
                {HEALTH_FEATURES.includes(f) ? <ShieldAlert className="size-4 text-warning" aria-label="Dado de saúde (LGPD)" /> : null}
              </span>
              <span className="block text-sm text-muted-foreground">{FEATURE_INFO[f].description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Units() {
  const { can } = useOrg();
  const { data } = useUnits();
  const [editing, setEditing] = React.useState<{ unit: UnitDto | null; key: number } | null>(null);
  const canEdit = can(Permission.UNITS_MANAGE);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((u) => (
          <button key={u.id} type="button" disabled={!canEdit} onClick={() => setEditing({ unit: u, key: Date.now() })} className="text-left">
            <Card className="h-full transition-colors hover:bg-muted">
              <p className="font-display text-lg font-extrabold">{u.name}</p>
              {u.city || u.street ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  {[u.street && `${u.street}${u.number ? `, ${u.number}` : ''}`, u.city && `${u.city}${u.state ? `/${u.state}` : ''}`].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <dl className="mt-3 grid grid-cols-[3rem_1fr] gap-x-2 gap-y-0.5 text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <React.Fragment key={d}>
                    <dt className="font-semibold text-muted-foreground">{WEEKDAY_SHORT[d]}</dt>
                    <dd className={cn('tabular', !u.businessHours[d].length && 'text-muted-foreground')}>{describeDay(u.businessHours[d])}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </Card>
          </button>
        ))}
      </div>
      {canEdit ? (
        <Button variant="outline" className="mt-3" onClick={() => setEditing({ unit: null, key: Date.now() })}>
          <Plus /> Nova unidade
        </Button>
      ) : null}
      {editing ? <UnitSheet key={editing.key} open onOpenChange={(v) => !v && setEditing(null)} unit={editing.unit} /> : null}
    </>
  );
}

function Payments() {
  const { org } = useOrg();
  const update = useUpdateOrganization();
  const [rows, setRows] = React.useState<PaymentMethodConfig[]>(org.paymentMethods);
  const [base, setBase] = React.useState<CommissionBase>(org.commissionBase);
  const dirty = JSON.stringify(rows) !== JSON.stringify(org.paymentMethods) || base !== org.commissionBase;
  const set = (i: number, patch: Partial<PaymentMethodConfig>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Card className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 font-bold">Forma</th>
              <th className="py-2 font-bold">Taxa</th>
              <th className="py-2 font-bold">Taxa fixa</th>
              <th className="py-2 font-bold">Recebe em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={r.method}>
                <td className="py-2 pr-3">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                    {PAYMENT_METHOD_LABEL[r.method]}
                  </label>
                </td>
                <td className="w-32 py-2 pr-2">
                  <PercentInput aria-label={`Taxa de ${PAYMENT_METHOD_LABEL[r.method]}`} value={r.feeBps} max={20} onChange={(v) => set(i, { feeBps: v ?? 0 })} className="h-10" />
                </td>
                <td className="w-36 py-2 pr-2">
                  <MoneyInput aria-label={`Taxa fixa de ${PAYMENT_METHOD_LABEL[r.method]}`} value={r.feeFixedCents} onChange={(v) => set(i, { feeFixedCents: v ?? 0 })} className="h-10" />
                </td>
                <td className="w-28 py-2">
                  <Input
                    aria-label={`Dias para receber ${PAYMENT_METHOD_LABEL[r.method]}`}
                    type="number"
                    min={0}
                    max={120}
                    value={r.settlementDays}
                    onChange={(e) => set(i, { settlementDays: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
                    className="h-10"
                    trailing={<span className="text-xs text-muted-foreground">dias</span>}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Comissão calculada sobre</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['BRUTO', 'Valor do serviço', 'Já com descontos, sem tirar a taxa da maquininha.'],
              ['LIQUIDO', 'Valor líquido', 'Tira a parte proporcional das taxas de pagamento.'],
            ] as const
          ).map(([v, title, text]) => (
            <label key={v} className={cn('flex cursor-pointer gap-3 rounded-2xl border-2 p-3', base === v ? 'border-primary bg-primary-soft' : 'border-input')}>
              <input type="radio" name="commission-base" checked={base === v} onChange={() => setBase(v)} className="mt-1 accent-[var(--primary)]" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button
          disabled={!dirty}
          loading={update.isPending}
          onClick={async () => {
            try {
              await update.mutateAsync({ paymentMethods: rows, commissionBase: base });
              toast.success('Pagamentos e comissão salvos');
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          Salvar
        </Button>
      </div>
    </Card>
  );
}

export default function ConfiguracoesPage() {
  const { can, org } = useOrg();
  const router = useRouter();
  const allowed = can(Permission.ORG_MANAGE);

  React.useEffect(() => {
    if (!allowed) router.replace('/inicio');
  }, [allowed, router]);
  if (!allowed) return null;

  return (
    <>
      <PageHeader title="Negócio" subtitle="Configurações" />
      <div className="space-y-10 px-5">
        <Section title="Dados do negócio" description="Aparecem na página de agendamento e nos recibos.">
          <BusinessInfo />
        </Section>
        <Section title="Aparência da página" description="Logo, imagem de fundo e cor que o cliente vê ao agendar online.">
          <BrandingEditor />
        </Section>
        <Section title="Taxa de agendamento" description="Cobrança de sinal ao marcar online, para reduzir faltas. Ainda não está disponível.">
          <BookingFee />
        </Section>
        <Section title="Unidades" description="Endereço e horário de funcionamento de cada local.">
          <Units />
        </Section>
        <Section title="Pagamentos e comissão" description="Taxas da maquininha e prazos de recebimento. A comissão de cada pessoa fica na Equipe; a de cada serviço, nos serviços.">
          <Payments />
        </Section>
        {org.features.includes(FeatureKey.FIDELIDADE) ? (
          <Section title="Pontos de fidelidade" description="Quanto cada real pago rende e quanto vale um resgate. Vale para as próximas comandas.">
            <Loyalty />
          </Section>
        ) : null}
        {org.features.includes(FeatureKey.ANAMNESE) || org.features.includes(FeatureKey.TERMOS) ? (
          <Section title="Fichas e termos" description="Modelos de anamnese e de termo de consentimento que você envia ao paciente. Mudar um modelo não altera o que já foi enviado.">
            <TemplatesEditor />
          </Section>
        ) : null}
        <Section title="Módulos" description="Ligue só o que o seu negócio usa — o resto some das telas. Os marcados com escudo guardam dados de saúde.">
          <Modules />
        </Section>
      </div>
    </>
  );
}
