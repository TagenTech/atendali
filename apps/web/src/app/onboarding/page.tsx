'use client';

import {
  canAssignRole,
  defaultBusinessHours,
  FEATURE_INFO,
  FEATURES,
  formatDuration,
  HEALTH_FEATURES,
  isFeatureAvailable,
  Role,
  ROLE_INFO,
  SEGMENT_PRESETS,
  SEGMENTS,
  validateBusinessHours,
  type CreateMemberRequest,
  type Feature,
  type SampleService,
  type Segment,
} from '@skedulei/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/logo';
import { SegmentIcon } from '@/components/layout/segment-icon';
import { BusinessHoursEditor } from '@/components/org/business-hours-editor';
import { UFS } from '@/components/org/unit-sheet';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { SwitchRow } from '@/components/ui/switch-row';
import { errorText } from '@/lib/api/client';
import * as orgApi from '@/lib/api/org';
import { useAuth } from '@/lib/auth';
import { celebrate } from '@/lib/celebrate';
import { firstName } from '@/lib/greeting';
import { orgKeys, useActivateOrg } from '@/lib/org';
import { cn, haptic } from '@/lib/utils';

const STEPS = ['Tipo de negócio', 'Seu negócio', 'Horário', 'Serviços', 'Equipe', 'Módulos'] as const;

type ServiceRow = SampleService & { selected: boolean };
type TeamRow = { name: string; email: string; role: Role };

const servicesFor = (s: Segment): ServiceRow[] => SEGMENT_PRESETS[s].sampleServices.map((x) => ({ ...x, selected: true }));

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const activate = useActivateOrg();
  const mine = useQuery({ queryKey: orgKeys.mine, queryFn: orgApi.myOrganizations });
  const hasOrgs = !!mine.data?.length;

  const [step, setStep] = React.useState(0);
  const [segment, setSegment] = React.useState<Segment | null>(null);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [city, setCity] = React.useState('');
  const [uf, setUf] = React.useState('');
  const [ownerBookable, setOwnerBookable] = React.useState(true);
  const [hours, setHours] = React.useState(defaultBusinessHours);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [team, setTeam] = React.useState<TeamRow[]>([]);
  const [features, setFeatures] = React.useState<Feature[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const vocab = segment ? SEGMENT_PRESETS[segment].vocabulary : SEGMENT_PRESETS.OUTRO.vocabulary;

  const pickSegment = (s: Segment) => {
    // Trocar de segmento recomeça serviços e módulos com os padrões dele.
    if (s !== segment) {
      setServices(servicesFor(s));
      setFeatures(SEGMENT_PRESETS[s].features.filter(isFeatureAvailable));
    }
    setSegment(s);
    setError(null);
    setStep(1);
  };

  const validate = (): string | null => {
    if (step === 0 && !segment) return 'Escolha o tipo de negócio';
    if (step === 1 && name.trim().length < 2) return 'Informe o nome do negócio';
    if (step === 2) return validateBusinessHours(hours);
    if (step === 3) {
      const bad = services.find((s) => s.selected && (!s.name.trim() || s.durationMinutes < 5));
      if (bad) return 'Confira nome e duração dos itens marcados';
    }
    if (step === 4) {
      for (const t of team) {
        if (!t.name.trim()) return 'Informe o nome de cada pessoa (ou remova a linha)';
        if (t.email && !/^\S+@\S+\.\S+$/.test(t.email)) return `E-mail inválido: ${t.email}`;
        if (!t.email && t.role !== Role.PROFISSIONAL) return `${t.name}: para dar esse acesso, informe o e-mail`;
      }
    }
    return null;
  };

  const next = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return haptic([30, 40, 30]);
    if (step < STEPS.length - 1) return setStep(step + 1);

    setSaving(true);
    try {
      const org = await orgApi.createOrganization({
        name: name.trim(),
        segment: segment!,
        features,
        phone: phone || null,
        ownerBookable,
        unit: { name: 'Principal', phone: phone || null, city: city.trim() || null, state: uf || null, businessHours: hours },
        services: services
          .filter((s) => s.selected)
          .map((s) => ({ name: s.name.trim(), category: s.category, durationMinutes: s.durationMinutes, priceCents: s.priceCents })),
        team: team.map<CreateMemberRequest>((t) => ({
          name: t.name.trim(),
          email: t.email.trim() || null,
          role: t.role,
          bookable: t.role === Role.PROFISSIONAL,
        })),
      });
      await activate(org.id);
      haptic([15, 60, 25]);
      celebrate();
      toast.success(`${org.name} está no ar! 🎉`);
      router.replace('/inicio');
    } catch (err) {
      setError(errorText(err, 'Não foi possível criar o negócio agora'));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
      {/* Desktop: trilha de passos fixa à esquerda. */}
      <aside className="hidden lg:block">
        <div className="sticky top-10 space-y-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-10" />
            <span className="font-display text-2xl font-black">Skedulei</span>
          </div>
          <ol className="space-y-1">
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold', i === step ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground enabled:hover:bg-muted')}
                >
                  <span className={cn('grid size-7 place-items-center rounded-full text-sm', i < step ? 'bg-success text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    {i < step ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          {hasOrgs ? (
            <Link href="/inicio" className="block px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
              ← Voltar para o app
            </Link>
          ) : null}
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col lg:min-h-0">
        {/* Celular: barra de progresso no topo. */}
        <div className="sticky top-0 z-20 bg-background/90 px-5 pb-3 pt-4 backdrop-blur-lg lg:hidden">
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button type="button" aria-label="Voltar" onClick={() => setStep(step - 1)} className="grid size-10 place-items-center rounded-xl hover:bg-muted">
                <ArrowLeft className="size-5" />
              </button>
            ) : hasOrgs ? (
              <Link href="/inicio" aria-label="Voltar para o app" className="grid size-10 place-items-center rounded-xl hover:bg-muted">
                <ArrowLeft className="size-5" />
              </Link>
            ) : (
              <LogoMark className="size-9" />
            )}
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Passo {step + 1} de {STEPS.length} · {STEPS[step]}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 px-5 pb-8 pt-4 lg:px-0 lg:pt-0">
          {step === 0 ? (
            <>
              <Intro title={`Bem-vindo(a), ${firstName(user?.name ?? '')}! 👋`} text="Que tipo de negócio você vai organizar? Isso ajusta as palavras, os serviços de exemplo e os módulos — dá para mudar depois." />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSegment(s)}
                    aria-pressed={segment === s}
                    className={cn(
                      'flex items-start gap-4 rounded-3xl border-2 bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary',
                      segment === s ? 'border-primary bg-primary-soft' : 'border-border',
                    )}
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                      <SegmentIcon segment={s} className="size-6" />
                    </span>
                    <span>
                      <span className="block font-display text-lg font-extrabold">{SEGMENT_PRESETS[s].label}</span>
                      <span className="block text-sm text-muted-foreground">{SEGMENT_PRESETS[s].description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Intro title="Sobre o seu negócio" text="O nome aparece na página onde seus clientes vão agendar." />
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <Field label="Nome do negócio" htmlFor="ob-name" className="sm:col-span-2">
                  <Input id="ob-name" value={name} maxLength={120} autoFocus placeholder={segment === 'BARBEARIA' ? 'Ex.: Barbearia do Zé' : 'Ex.: Studio Bella'} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="WhatsApp do negócio" htmlFor="ob-phone" className="sm:col-span-2">
                  <PhoneInput id="ob-phone" value={phone} onChange={setPhone} />
                </Field>
                <Field label="Cidade" htmlFor="ob-city">
                  <Input id="ob-city" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="UF" htmlFor="ob-uf">
                  <select id="ob-uf" value={uf} onChange={(e) => setUf(e.target.value)} className="h-13 w-full rounded-2xl border-2 border-input bg-card px-3 outline-none focus:border-primary">
                    <option value="">—</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <SwitchRow id="ob-bookable" checked={ownerBookable} onCheckedChange={setOwnerBookable} title={`Você também atende ${vocab.clients.toLowerCase()}?`} description="Se sim, você ganha sua própria coluna na agenda." />
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Intro title="Horário de funcionamento" text="A agenda online só oferece horários dentro destas faixas. Use + para o intervalo de almoço." />
              <div className="max-w-2xl">
                <BusinessHoursEditor value={hours} onChange={setHours} />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Intro title={`${vocab.services} que você oferece`} text="Deixamos alguns de exemplo. Ajuste preço e duração, desmarque o que não faz e adicione os seus." />
              <ul className="max-w-3xl space-y-2">
                {services.map((s, i) => (
                  <li key={i} className={cn('grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border-2 bg-card p-3 sm:grid-cols-[auto_1fr_8rem_9rem]', s.selected ? 'border-input' : 'border-transparent opacity-60')}>
                    <input
                      type="checkbox"
                      checked={s.selected}
                      aria-label={`Incluir ${s.name || 'item'}`}
                      onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                      className="size-5 accent-[var(--primary)]"
                    />
                    <input
                      value={s.name}
                      aria-label="Nome"
                      placeholder="Nome"
                      maxLength={120}
                      onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      className="min-w-0 bg-transparent font-semibold outline-none"
                    />
                    <label className="col-start-2 flex items-center gap-1.5 text-sm text-muted-foreground sm:col-start-auto">
                      <input
                        type="number"
                        min={5}
                        max={720}
                        step={5}
                        value={s.durationMinutes}
                        aria-label={`Duração de ${s.name} em minutos`}
                        onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, durationMinutes: Number(e.target.value) || 0 } : x)))}
                        className="h-9 w-16 rounded-lg border-2 border-input bg-card px-2 text-center tabular text-foreground outline-none focus:border-primary"
                      />
                      min
                      <span className="sr-only">({formatDuration(s.durationMinutes)})</span>
                    </label>
                    <div className="col-start-2 sm:col-start-auto">
                      <MoneyInput
                        aria-label={`Preço de ${s.name}`}
                        value={s.priceCents}
                        onChange={(v) => setServices(services.map((x, j) => (j === i ? { ...x, priceCents: v ?? 0 } : x)))}
                        className="h-10"
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => setServices([...services, { name: '', category: 'Outros', durationMinutes: 60, priceCents: 0, selected: true }])}
              >
                <Plus /> Adicionar {vocab.service.toLowerCase()}
              </Button>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Intro title="Sua equipe" text="Opcional — dá para fazer depois. Quem tem e-mail recebe um convite; sem e-mail, a pessoa só aparece na agenda." />
              <ul className="max-w-3xl space-y-2">
                {team.map((t, i) => (
                  <li key={i} className="grid gap-2 rounded-2xl border-2 border-input bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_auto] sm:items-center">
                    <Input aria-label="Nome" placeholder="Nome" value={t.name} className="h-11" onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input aria-label="E-mail" type="email" placeholder="E-mail (opcional)" value={t.email} className="h-11" onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    <select
                      aria-label="Perfil de acesso"
                      value={t.role}
                      onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}
                      className="h-11 rounded-2xl border-2 border-input bg-card px-3 outline-none focus:border-primary"
                    >
                      {Object.values(Role)
                        .filter((r) => canAssignRole(Role.DONO, r))
                        .map((r) => (
                          <option key={r} value={r}>
                            {ROLE_INFO[r].label}
                          </option>
                        ))}
                    </select>
                    <button type="button" aria-label="Remover" onClick={() => setTeam(team.filter((_, j) => j !== i))} className="grid size-11 place-items-center justify-self-end rounded-xl text-muted-foreground hover:bg-muted">
                      <Trash2 className="size-5" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => setTeam([...team, { name: '', email: '', role: Role.PROFISSIONAL }])}>
                <Plus /> Adicionar pessoa
              </Button>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Intro title="Módulos" text={`Ligamos os mais usados por ${segment ? SEGMENT_PRESETS[segment].label.toLowerCase() : 'negócios como o seu'}. O núcleo (agenda, clientes, financeiro e relatórios) vem sempre.`} />
              <div className="grid max-w-3xl gap-2 sm:grid-cols-2">
                {FEATURES.map((f) => {
                  const on = features.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={!isFeatureAvailable(f)}
                      onClick={() => setFeatures(on ? features.filter((x) => x !== f) : [...features, f])}
                      className={cn('flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left', on ? 'border-primary bg-primary-soft' : 'border-input bg-card hover:bg-muted', !isFeatureAvailable(f) && 'cursor-not-allowed opacity-60 hover:bg-card')}
                    >
                      <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                        {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span>
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
            </>
          ) : null}

          {error ? (
            <p role="alert" className="max-w-2xl rounded-2xl bg-danger-soft px-4 py-3 font-medium text-danger-soft-foreground">
              {error}
            </p>
          ) : null}
        </div>

        {step > 0 ? (
          <div className="sticky bottom-0 z-20 border-t border-border bg-[var(--nav-bg)] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="flex max-w-3xl gap-3">
              <Button variant="ghost" className="hidden lg:inline-flex" onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
              <Button className="flex-1 lg:ml-auto lg:flex-none" size="lg" loading={saving} onClick={next}>
                {step === STEPS.length - 1 ? 'Criar meu negócio' : step === 4 && !team.length ? 'Pular por agora' : 'Continuar'}
              </Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <header className="max-w-2xl">
      <h1 className="text-3xl font-black lg:text-4xl">{title}</h1>
      <p className="mt-2 text-muted-foreground lg:text-lg">{text}</p>
    </header>
  );
}
