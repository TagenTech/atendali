/**
 * Agenda: status dos agendamentos, disponibilidade de horários e mensagens.
 * Instantes em ISO UTC; o dia/horário de funcionamento é sempre lido no fuso da unidade.
 */
import type { BusinessHours } from './business-hours';
import type { IsoDate } from './dates';
import type { GuardianRelationship } from './guardian';
import { formatBRL } from './money';
import { formatDuration, zonedParts, zonedToUtc } from './time';

export const AppointmentStatus = {
  AGENDADO: 'AGENDADO',
  CONFIRMADO: 'CONFIRMADO',
  CHEGOU: 'CHEGOU',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  CONCLUIDO: 'CONCLUIDO',
  FALTOU: 'FALTOU',
  CANCELADO: 'CANCELADO',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CHEGOU: 'Chegou',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDO: 'Concluído',
  FALTOU: 'Faltou',
  CANCELADO: 'Cancelado',
};

/** Próximos passos permitidos a partir de cada status (o fluxo do dia na recepção). */
export const STATUS_FLOW: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  AGENDADO: ['CONFIRMADO', 'CHEGOU', 'EM_ATENDIMENTO', 'CONCLUIDO', 'FALTOU', 'CANCELADO'],
  CONFIRMADO: ['AGENDADO', 'CHEGOU', 'EM_ATENDIMENTO', 'CONCLUIDO', 'FALTOU', 'CANCELADO'],
  CHEGOU: ['CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO'],
  EM_ATENDIMENTO: ['CHEGOU', 'CONCLUIDO'],
  CONCLUIDO: ['EM_ATENDIMENTO'],
  FALTOU: ['AGENDADO', 'CONFIRMADO'],
  CANCELADO: ['AGENDADO'],
};

export function canMoveTo(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return from === to || STATUS_FLOW[from].includes(to);
}

/** Cancelado não ocupa a agenda; os demais ocupam (inclusive falta, para não remarcar em cima). */
export const occupiesSlot = (s: AppointmentStatus) => s !== AppointmentStatus.CANCELADO;

export const AppointmentSource = {
  RECEPCAO: 'RECEPCAO',
  ONLINE: 'ONLINE',
} as const;
export type AppointmentSource = (typeof AppointmentSource)[keyof typeof AppointmentSource];

/** Regras do agendamento online (fixas na fase 1; viram configuração do negócio depois). */
export const ONLINE_BOOKING = {
  /** Antecedência mínima para marcar. */
  minLeadMinutes: 60,
  /** Até quantos dias à frente. */
  maxDaysAhead: 60,
  /** Até quantas horas antes o cliente cancela sozinho. */
  cancelUntilHours: 2,
  /** Horários futuros que um mesmo telefone (a família toda) mantém marcados pela página pública. */
  maxActivePerPhone: 5,
  stepMinutes: 15,
  /** "Minhas reservas": código de 6 dígitos enviado ao e-mail cadastrado no telefone. */
  codeTtlMinutes: 10,
  codeMaxAttempts: 5,
  codeMaxPerHour: 5,
  portalSessionMinutes: 60,
  /** Procedimentos numa mesma reserva (carrinho). */
  maxItemsPerBooking: 5,
} as const;

// ------------------------------------------------------------------ disponibilidade

export interface Interval {
  /** epoch ms */
  start: number;
  end: number;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export interface SlotQuery {
  date: IsoDate;
  timezone: string;
  hours: BusinessHours;
  durationMinutes: number;
  /** Ocupado (agendamentos que ocupam a agenda + bloqueios). */
  busy: Interval[];
  stepMinutes?: number;
  /** Agora (epoch ms) + antecedência mínima: nada começa antes disso. */
  notBefore?: number;
}

/**
 * Horários livres de um profissional num dia: dentro das faixas de funcionamento, cabendo a
 * duração inteira, sem encostar em nada ocupado e respeitando a antecedência mínima.
 * Devolve os inícios em ISO UTC, em ordem.
 */
export function availableSlots(q: SlotQuery): string[] {
  const step = (q.stepMinutes ?? 15) * 60_000;
  const duration = q.durationMinutes * 60_000;
  const weekday = new Date(`${q.date}T00:00:00Z`).getUTCDay();
  const out: string[] = [];
  for (const range of q.hours[weekday] ?? []) {
    const open = zonedToUtc(q.date, range.start, q.timezone).getTime();
    const close = zonedToUtc(q.date, range.end, q.timezone).getTime();
    for (let t = open; t + duration <= close; t += step) {
      if (q.notBefore !== undefined && t < q.notBefore) continue;
      const slot = { start: t, end: t + duration };
      if (!q.busy.some((b) => overlaps(slot, b))) out.push(new Date(t).toISOString());
    }
  }
  return out;
}

/** O intervalo [início, fim) cabe inteiro numa faixa de funcionamento do dia (no fuso da unidade)? */
export function withinBusinessHours(start: Date, end: Date, hours: BusinessHours, timezone: string): boolean {
  const s = zonedParts(start, timezone);
  const e = zonedParts(new Date(end.getTime() - 1), timezone);
  if (s.date !== e.date) return false;
  const endMinutes = e.minutes + 1;
  return (hours[s.weekday] ?? []).some((r) => {
    const [rs, re] = [toMin(r.start), toMin(r.end)];
    return s.minutes >= rs && endMinutes <= re;
  });
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ------------------------------------------------------------------ mensagens

/** Mensagem de confirmação para o WhatsApp do cliente. */
export function confirmationMessage(a: {
  clientName: string;
  organizationName: string;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  timezone: string;
  priceCents?: number;
}): string {
  const { date, time } = zonedParts(new Date(a.startsAt), a.timezone);
  const [y, m, d] = date.split('-');
  const first = a.clientName.trim().split(/\s+/)[0];
  const price = a.priceCents ? ` (${formatBRL(a.priceCents)})` : '';
  return (
    `Oi, ${first}! Seu horário em ${a.organizationName}: ${a.serviceName}${price} com ${a.professionalName}, ` +
    `dia ${d}/${m}/${y} às ${time}. Pode confirmar respondendo esta mensagem? 😊`
  );
}

export const durationLabel = formatDuration;

// ------------------------------------------------------------------ DTOs

export interface ClientDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: IsoDate | null;
  /** Quem responde pelo paciente (criança, idoso): o telefone costuma ser dele. */
  guardianName: string | null;
  guardianRelationship: GuardianRelationship | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
}

export interface ClientInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  birthDate?: IsoDate | null;
  guardianName?: string | null;
  guardianRelationship?: GuardianRelationship | null;
  notes?: string | null;
  tags?: string[];
}

export interface ClientDetailDto extends ClientDto {
  /** Outros pacientes do mesmo negócio com o mesmo telefone (irmãos, pais e filhos). */
  relatives: { id: string; name: string; birthDate: IsoDate | null }[];
  appointments: AppointmentDto[];
  stats: { total: number; done: number; noShows: number; spentCents: number; lastVisit: string | null };
}

export interface AppointmentDto {
  id: string;
  unitId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  memberId: string;
  memberName: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  /** Preço combinado (centavos), copiado do serviço na hora de marcar. */
  priceCents: number;
  notes: string | null;
  source: AppointmentSource;
  /** Comanda aberta/paga deste atendimento (null = ainda não). */
  orderId: string | null;
  /** Quando foi chamado no painel de TV (null = não chamado). */
  calledAt: string | null;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  /** Cliente existente… */
  clientId?: string;
  /** …ou novo, criado junto. */
  newClient?: { name: string; phone?: string | null };
  memberId: string;
  serviceId: string;
  startsAt: string;
  /** Se omitido, a duração do serviço. */
  durationMinutes?: number;
  priceCents?: number;
  notes?: string | null;
  unitId?: string;
  /** Recepção pode encaixar fora do horário de funcionamento. */
  allowOutsideHours?: boolean;
}

export interface UpdateAppointmentRequest {
  memberId?: string;
  startsAt?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  priceCents?: number;
  notes?: string | null;
  allowOutsideHours?: boolean;
}

export interface BlockDto {
  id: string;
  /** null = a unidade inteira (feriado, reforma). */
  memberId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface CreateBlockRequest {
  memberId?: string | null;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

export interface AgendaDayDto {
  /** Primeiro dia do período (o dia, na visão de dia). */
  date: IsoDate;
  /** Quantos dias o período cobre (1 = dia, 7 = semana). */
  days: number;
  timezone: string;
  unitId: string;
  hours: BusinessHours;
  /** Colunas da agenda (profissional sem "ver todos" recebe só a própria). */
  professionals: { id: string; name: string; color: number; hours: BusinessHours }[];
  appointments: AppointmentDto[];
  blocks: BlockDto[];
}

export interface SlotsDto {
  date: IsoDate;
  /** Por início: quem está livre. */
  slots: { startsAt: string; memberIds: string[] }[];
}

// ------------------------------------------------------------------ agendamento online (público)

export interface PublicOrgDto {
  name: string;
  slug: string;
  segment: import('./segments').Segment;
  vocabulary: import('./segments').Vocabulary;
  phone: string | null;
  branding: import('./branding').BrandingDto;
  unit: { id: string; name: string; address: string | null; timezone: string; businessHours: BusinessHours } | null;
  services: { id: string; name: string; category: string | null; description: string | null; durationMinutes: number; priceCents: number }[];
  professionals: { id: string; name: string; color: number }[];
  /** Avaliações dos clientes (só as publicadas). */
  rating: { count: number; averageTimes10: number };
  reviews: { rating: number; comment: string | null; authorName: string; createdAt: string }[];
}

export interface PublicBookingRequest {
  serviceId: string;
  /** Omitido = qualquer profissional livre. */
  memberId?: string | null;
  startsAt: string;
  /** Quem está marcando (a pessoa que tem o telefone). */
  name: string;
  phone: string;
  email?: string | null;
  /** Preenchidos quando a reserva é para outra pessoa (filho, mãe…): o paciente passa a ser ele. */
  patientName?: string | null;
  patientBirthDate?: IsoDate | null;
  relationship?: GuardianRelationship | null;
}

export interface PublicBookingDto {
  /** Código para ver/cancelar pelo link (vai na URL de gestão). */
  token: string;
  organizationName: string;
  organizationSlug: string;
  organizationPhone: string | null;
  serviceId: string;
  serviceName: string;
  professionalName: string;
  /** Quem será atendido (pode ser outra pessoa, não quem marcou). */
  clientName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AppointmentStatus;
  address: string | null;
  canCancel: boolean;
}

// ------------------------------------------------------------------ reserva com vários procedimentos (carrinho)

export interface BookingItemRequest {
  serviceId: string;
  /** Omitido = qualquer profissional livre. */
  memberId?: string | null;
  startsAt: string;
}

/** Vários procedimentos de uma vez, cada um no seu horário: tudo ou nada, com um link só. */
export interface PublicGroupBookingRequest {
  items: BookingItemRequest[];
  name: string;
  phone: string;
  email?: string | null;
  patientName?: string | null;
  patientBirthDate?: IsoDate | null;
  relationship?: GuardianRelationship | null;
}

export interface PublicBookingItemDto {
  id: string;
  serviceId: string;
  serviceName: string;
  professionalName: string;
  clientName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  canCancel: boolean;
  /** Ainda não confirmou a presença (agendado, antes do horário). */
  canConfirm: boolean;
}

/** A reserva (um ou mais procedimentos) que o link `/reserva/<token>` mostra. */
export interface PublicGroupBookingDto {
  token: string;
  organizationName: string;
  organizationSlug: string;
  organizationPhone: string | null;
  timezone: string;
  address: string | null;
  items: PublicBookingItemDto[];
}

/** Um jeito de encaixar todos em sequência: início do 1º e quem atende cada um. */
export interface SequencePlanDto {
  startsAt: string;
  items: { serviceId: string; memberId: string; startsAt: string; endsAt: string }[];
}

export interface SequenceSlotsDto {
  date: IsoDate;
  options: SequencePlanDto[];
}

/**
 * Procedimentos um logo após o outro: para cada início possível do primeiro, vê se o segundo tem alguém livre
 * assim que o primeiro acaba, e assim por diante (quem atendeu o anterior continua, se estiver livre).
 * `offered[i]` mapeia início (ISO) → profissionais livres para o procedimento i, numa grade fina (5 min).
 */
export function planSequences(p: {
  services: { serviceId: string; durationMinutes: number }[];
  offered: Record<string, string[]>[];
  firstStarts: string[];
}): SequencePlanDto[] {
  const plans: SequencePlanDto[] = [];
  for (const first of p.firstStarts) {
    let t = new Date(first).getTime();
    let previous: string | null = null;
    const items: SequencePlanDto['items'] = [];
    let ok = true;
    for (let i = 0; i < p.services.length; i++) {
      const startsAt = new Date(t).toISOString();
      const members: string[] | undefined = p.offered[i]?.[startsAt];
      if (!members?.length) {
        ok = false;
        break;
      }
      const memberId: string = previous && members.includes(previous) ? previous : members[0];
      const endsAt = new Date(t + p.services[i].durationMinutes * 60_000).toISOString();
      items.push({ serviceId: p.services[i].serviceId, memberId, startsAt, endsAt });
      t += p.services[i].durationMinutes * 60_000;
      previous = memberId;
    }
    if (ok) plans.push({ startsAt: first, items });
  }
  return plans;
}

/** Algum par de intervalos [início, fim) se sobrepõe? (a mesma pessoa não está em dois lugares ao mesmo tempo) */
export function anyOverlap(intervals: { startsAt: string; endsAt: string }[]): boolean {
  const sorted = [...intervals].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return sorted.some((x, i) => i > 0 && new Date(x.startsAt).getTime() < new Date(sorted[i - 1].endsAt).getTime());
}

/** Uma reserva na área "Minhas reservas" (todas as pessoas do mesmo telefone naquele negócio). */
export interface PortalBookingDto {
  id: string;
  patientName: string;
  serviceId: string;
  serviceName: string;
  memberId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AppointmentStatus;
  address: string | null;
  /** Cancelar e remarcar valem a mesma antecedência mínima. */
  canChange: boolean;
}

export interface PortalCodeRequest {
  phone: string;
}

export interface PortalVerifyRequest {
  phone: string;
  code: string;
}

export interface PortalSessionDto {
  token: string;
  expiresIn: number;
}

export interface RescheduleRequest {
  startsAt: string;
  /** Omitido = qualquer profissional livre. */
  memberId?: string | null;
  /** Reserva com vários procedimentos: qual deles (obrigatório quando há mais de um). */
  itemId?: string | null;
}

/** Até quando o cliente pode cancelar online. */
export function canClientCancel(status: AppointmentStatus, startsAt: string, now = Date.now()): boolean {
  if (status !== 'AGENDADO' && status !== 'CONFIRMADO') return false;
  return new Date(startsAt).getTime() - now >= ONLINE_BOOKING.cancelUntilHours * 3_600_000;
}

// ------------------------------------------------------------------ lista de espera

export interface WaitlistEntryDto {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  /** Preferência de profissional (null = qualquer um). */
  memberId: string | null;
  memberName: string | null;
  /** Dia desejado (null = qualquer dia). */
  preferredDate: IsoDate | null;
  notes: string | null;
  /** Último horário que vagou e combina com o pedido (avisar o cliente). */
  openSlot: { startsAt: string; memberId: string; memberName: string } | null;
  createdAt: string;
}

export interface CreateWaitlistRequest {
  clientId?: string;
  newClient?: { name: string; phone?: string | null };
  serviceId?: string | null;
  memberId?: string | null;
  preferredDate?: IsoDate | null;
  notes?: string | null;
}

/** Um horário que vagou serve para o pedido da lista de espera? */
export function waitlistMatches(
  entry: { serviceId: string | null; memberId: string | null; preferredDate: IsoDate | null },
  freed: { serviceId: string; memberId: string; date: IsoDate },
): boolean {
  return (
    (!entry.preferredDate || entry.preferredDate === freed.date) &&
    (!entry.memberId || entry.memberId === freed.memberId) &&
    (!entry.serviceId || entry.serviceId === freed.serviceId)
  );
}

/** Mensagem para avisar no WhatsApp que abriu vaga. */
export function slotOpenedMessage(a: { clientName: string; organizationName: string; startsAt: string; timezone: string; professionalName: string }): string {
  const { date, time } = zonedParts(new Date(a.startsAt), a.timezone);
  const [, m, d] = date.split('-');
  return `Oi, ${a.clientName.trim().split(/\s+/)[0]}! Abriu um horário em ${a.organizationName}: dia ${d}/${m} às ${time} com ${a.professionalName}. Quer que eu reserve para você? 😊`;
}
