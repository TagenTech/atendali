'use client';

import {
  addDays,
  formatBRL,
  formatDuration,
  isValidPhone,
  ONLINE_BOOKING,
  todayIn,
  WEEKDAYS_SHORT,
  whatsappLink,
  zonedParts,
  type PublicOrgDto,
} from '@agendei/contracts';
import { BRAND_COLORS, formatRating, type BrandColor } from '@agendei/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, MapPin, MessageCircle, UserRound, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { LogoMark } from '@/components/brand/logo';
import { SegmentIcon } from '@/components/layout/segment-icon';
import { memberColor } from '@/components/org/member-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Stars } from '@/components/ui/stars';
import * as agendaApi from '@/lib/api/agenda';
import { apiAsset, errorText } from '@/lib/api/client';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/utils';

type Service = PublicOrgDto['services'][number];
const ANY = 'qualquer';
const DAYS_SHOWN = 21;

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
      <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span>
      {children}
    </h2>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const page = useQuery({ queryKey: ['public', slug], queryFn: () => agendaApi.publicPage(slug), retry: false });
  const org = page.data;

  const [service, setService] = React.useState<Service | null>(null);
  const [pro, setPro] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<string | null>(null);
  const [startsAt, setStartsAt] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const tz = org?.unit?.timezone ?? 'America/Sao_Paulo';
  const today = hydrated ? todayIn(tz) : null;
  const memberId = pro && pro !== ANY ? pro : undefined;
  const slots = useQuery({
    queryKey: ['public', slug, 'slots', service?.id, memberId, date],
    queryFn: () => agendaApi.publicSlots(slug, { date: date!, serviceId: service!.id, memberId }),
    enabled: !!service && !!pro && !!date,
  });

  if (page.isError) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <EmptyState emoji="🔎" title="Página não encontrada" description="Confira o link com o estabelecimento." />
      </main>
    );
  }
  if (!org) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </main>
    );
  }

  const cover = apiAsset(org.branding.coverUrl);
  const logo = apiAsset(org.branding.logoUrl);
  const openDays = today
    ? Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)).filter((d) => (org.unit?.businessHours[new Date(`${d}T00:00:00Z`).getUTCDay()] ?? []).length)
    : [];
  const proName = (id: string) => org.professionals.find((p) => p.id === id)?.name ?? '';
  const timeOf = (iso: string) => zonedParts(new Date(iso), tz).time;
  const groups = Object.entries(
    org.services.reduce<Record<string, Service[]>>((acc, s) => ((acc[s.category ?? org.vocabulary.services] ??= []).push(s), acc), {}),
  );

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Informe seu nome');
    if (!isValidPhone(phone)) return setError('Informe um celular válido, com DDD');
    setSaving(true);
    setError(null);
    try {
      const res = await agendaApi.publicBook(slug, {
        serviceId: service!.id,
        memberId: memberId ?? null,
        startsAt: startsAt!,
        name: name.trim(),
        phone,
        email: email.trim() || null,
      });
      router.push(`/reserva/${res.token}`);
    } catch (err) {
      setError(errorText(err, 'Não foi possível agendar agora'));
      setStartsAt(null);
      void slots.refetch();
      setSaving(false);
    }
  };

  return (
    <main className="min-h-dvh pb-16 pt-safe" style={brandStyle(org.branding.brandColor)}>
      <header className={cn('relative overflow-hidden border-b border-border bg-card', cover && 'text-white')}>
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- fundo já reduzido, servido pela própria API */}
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/10" aria-hidden />
          </>
        ) : null}
        <div className={cn('relative mx-auto flex max-w-5xl items-center gap-4 px-5', cover ? 'min-h-48 items-end py-6 lg:min-h-60' : 'py-6')}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo já reduzida, servida pela própria API
            <img src={logo} alt={`Logo de ${org.name}`} className="size-16 shrink-0 rounded-2xl bg-card object-contain p-1.5 shadow-soft lg:size-20" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <SegmentIcon segment={org.segment} className="size-7" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black lg:text-3xl">{org.name}</h1>
            {org.branding.tagline ? <p className={cn('text-sm lg:text-base', cover ? 'text-white/85' : 'text-muted-foreground')}>{org.branding.tagline}</p> : null}
            {org.rating.count > 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <Stars value={org.rating.averageTimes10 / 10} />
                <span className="font-semibold tabular">{formatRating(org.rating.averageTimes10)}</span>
                <span className={cover ? 'text-white/85' : 'text-muted-foreground'}>({org.rating.count} {org.rating.count === 1 ? 'avaliação' : 'avaliações'})</span>
              </p>
            ) : null}
            {org.unit?.address ? (
              <p className={cn('flex items-center gap-1.5 truncate text-sm', cover ? 'text-white/85' : 'text-muted-foreground')}>
                <MapPin className="size-4 shrink-0" /> {org.unit.address}
              </p>
            ) : null}
          </div>
          {org.phone ? (
            <Button asChild size="sm" variant="outline">
              <a href={whatsappLink(org.phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> <span className="hidden sm:inline">WhatsApp</span>
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          {/* 1. Serviço */}
          <section>
            <StepTitle n={1}>Escolha o {org.vocabulary.service.toLowerCase()}</StepTitle>
            {org.services.length ? (
              <div className="space-y-4">
                {groups.map(([cat, items]) => (
                  <div key={cat}>
                    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</p>
                    <div className={cn('grid gap-2', items.length > 1 && 'sm:grid-cols-2')}>
                      {items.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={service?.id === s.id}
                          onClick={() => (setService(s), setStartsAt(null))}
                          className={cn(
                            'rounded-2xl border-2 bg-card p-4 text-left transition-colors',
                            service?.id === s.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50',
                          )}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-semibold">{s.name}</span>
                            <span className="font-display font-extrabold tabular">{s.priceCents ? formatBRL(s.priceCents) : 'Gratuito'}</span>
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="size-3.5" /> {formatDuration(s.durationMinutes)}
                          </span>
                          {s.description ? <span className="mt-1 block text-sm text-muted-foreground">{s.description}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">O agendamento online ainda não está aberto. Fale com o estabelecimento.</p>
            )}
          </section>

          {/* 2. Profissional */}
          {service ? (
            <section>
              <StepTitle n={2}>Com quem?</StepTitle>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={pro === ANY}
                  onClick={() => (setPro(ANY), setStartsAt(null))}
                  className={cn('flex items-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold', pro === ANY ? 'border-primary bg-primary-soft' : 'border-border bg-card')}
                >
                  <Users className="size-5" /> Qualquer pessoa
                </button>
                {org.professionals.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={pro === p.id}
                    onClick={() => (setPro(p.id), setStartsAt(null))}
                    className={cn('flex items-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold', pro === p.id ? 'border-primary bg-primary-soft' : 'border-border bg-card')}
                  >
                    <span className="grid size-7 place-items-center rounded-lg text-xs font-black" style={memberColor(p.color)}>
                      {p.name[0]}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* 3. Dia e horário */}
          {service && pro ? (
            <section>
              <StepTitle n={3}>Dia e horário</StepTitle>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 scrollbar-none">
                {openDays.map((d) => {
                  const [, m, dd] = d.split('-');
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={date === d}
                      aria-label={`Dia ${dd}/${m}`}
                      onClick={() => (setDate(d), setStartsAt(null))}
                      className={cn(
                        'flex w-16 shrink-0 flex-col items-center rounded-2xl border-2 py-2',
                        date === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                      )}
                    >
                      <span className="text-xs font-bold uppercase">{d === today ? 'hoje' : WEEKDAYS_SHORT[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                      <span className="font-display text-xl font-black">{dd}</span>
                    </button>
                  );
                })}
              </div>
              {date ? (
                slots.isLoading ? (
                  <Skeleton className="mt-3 h-24 rounded-2xl" />
                ) : slots.data?.slots.length ? (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.data.slots.map((s) => (
                      <button
                        key={s.startsAt}
                        type="button"
                        aria-pressed={startsAt === s.startsAt}
                        onClick={() => setStartsAt(s.startsAt)}
                        className={cn(
                          'rounded-xl border-2 py-2 font-semibold tabular',
                          startsAt === s.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50',
                        )}
                      >
                        {timeOf(s.startsAt)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-muted-foreground">Sem horários livres nesse dia. Tente outro. 🙏</p>
                )
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Escolha um dia (até {ONLINE_BOOKING.maxDaysAhead} dias à frente).</p>
              )}
            </section>
          ) : null}

          {/* 4. Dados */}
          {startsAt ? (
            <section>
              <StepTitle n={4}>Seus dados</StepTitle>
              <form onSubmit={book} className="grid max-w-xl gap-4" noValidate>
                <Field label="Seu nome" htmlFor="bk-name">
                  <Input id="bk-name" autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Celular (WhatsApp)" htmlFor="bk-phone" hint="Para confirmar o horário com você">
                  <PhoneInput id="bk-phone" value={phone} onChange={setPhone} />
                </Field>
                <Field label="E-mail (opcional)" htmlFor="bk-email" hint="Mandamos o comprovante e o link para cancelar">
                  <Input id="bk-email" type="email" autoComplete="email" value={email} maxLength={180} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                {error ? (
                  <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" size="lg" loading={saving}>
                  Confirmar agendamento
                </Button>
              </form>
            </section>
          ) : error ? (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground">
              {error}
            </p>
          ) : null}

          {org.reviews.length ? (
            <section aria-label="Avaliações">
              <h2 className="mb-3 font-display text-lg font-extrabold">O que dizem</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {org.reviews.slice(0, 6).map((r, i) => (
                  <li key={i}>
                    <Card className="h-full space-y-1 p-4">
                      <Stars value={r.rating} />
                      {r.comment ? <p className="text-sm">{r.comment}</p> : null}
                      <p className="text-xs font-semibold text-muted-foreground">{r.authorName}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Resumo (fixo ao lado no desktop) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-3">
            <p className="font-display text-lg font-extrabold">Resumo</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className={cn('size-4', service ? 'text-success' : 'text-border')} />
                {service ? `${service.name} · ${formatDuration(service.durationMinutes)}` : `Escolha o ${org.vocabulary.service.toLowerCase()}`}
              </li>
              <li className="flex items-center gap-2">
                <UserRound className={cn('size-4', pro ? 'text-success' : 'text-border')} />
                {pro ? (pro === ANY ? 'Qualquer pessoa' : proName(pro)) : 'Profissional'}
              </li>
              <li className="flex items-center gap-2">
                <Clock className={cn('size-4', startsAt ? 'text-success' : 'text-border')} />
                {startsAt && date ? `${date.split('-').reverse().slice(0, 2).join('/')} às ${timeOf(startsAt)}` : 'Dia e horário'}
              </li>
            </ul>
            {service?.priceCents ? (
              <p className="border-t border-border pt-3 font-display text-xl font-black tabular">{formatBRL(service.priceCents)}</p>
            ) : null}
            {startsAt ? null : (
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <ArrowLeft /> Voltar ao início
              </Button>
            )}
          </Card>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <LogoMark className="size-4" /> Agendamento por Agendei
          </p>
        </aside>
      </div>
    </main>
  );
}

/** Cor de destaque do negócio: troca os tokens de cor primária só nesta página. */
function brandStyle(key: BrandColor | null): React.CSSProperties | undefined {
  if (!key) return undefined;
  const hex = BRAND_COLORS[key].hex;
  return {
    '--primary': hex,
    '--primary-hover': `color-mix(in srgb, ${hex} 85%, black)`,
    '--primary-foreground': '#ffffff',
    '--primary-soft': `color-mix(in srgb, ${hex} 14%, var(--background))`,
    '--primary-soft-foreground': `color-mix(in srgb, ${hex} 70%, var(--foreground))`,
  } as React.CSSProperties;
}
