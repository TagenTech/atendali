/**
 * Pacotes de sessões, clube de assinatura, vale-presente, fidelidade, avaliações e painel de TV.
 * Datas de calendário 'YYYY-MM-DD'; dinheiro em centavos; regras sempre puras.
 */
import { addDays, type IsoDate } from './dates';
import { addMonths, dayOfMonth, monthOf } from './time';

// ------------------------------------------------------------------ pacotes de sessões

export type PackageStatus = 'ATIVO' | 'ESGOTADO' | 'EXPIRADO';

export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = { ATIVO: 'Ativo', ESGOTADO: 'Sessões usadas', EXPIRADO: 'Vencido' };

export const sessionsLeft = (p: { sessionsTotal: number; sessionsUsed: number }) => Math.max(0, p.sessionsTotal - p.sessionsUsed);

/** Esgotado vale mais que vencido (não sobra nada a perder); vence no fim do dia `expiresAt`. */
export function packageStatus(p: { sessionsTotal: number; sessionsUsed: number; expiresAt: IsoDate | null }, today: IsoDate): PackageStatus {
  if (sessionsLeft(p) === 0) return 'ESGOTADO';
  if (p.expiresAt && today > p.expiresAt) return 'EXPIRADO';
  return 'ATIVO';
}

/** Validade em dias a partir da compra (null = sem validade). */
export const packageExpiry = (purchased: IsoDate, validityDays: number | null): IsoDate | null =>
  validityDays ? addDays(purchased, validityDays) : null;

/** Valor de cada sessão (base da comissão do profissional que a realiza). */
export const sessionValueCents = (priceCents: number, sessions: number) => (sessions > 0 ? Math.round(priceCents / sessions) : 0);

// ------------------------------------------------------------------ clube de assinatura

export type MembershipStatus = 'ATIVA' | 'PAUSADA' | 'CANCELADA';
/** Situação para uso: EM_DIA pode usar; VENCIDA = mensalidade em atraso. */
export type MembershipState = 'EM_DIA' | 'VENCIDA' | 'PAUSADA' | 'CANCELADA';

export const MEMBERSHIP_STATE_LABEL: Record<MembershipState, string> = {
  EM_DIA: 'Em dia',
  VENCIDA: 'Mensalidade vencida',
  PAUSADA: 'Pausada',
  CANCELADA: 'Cancelada',
};

/** Aceita renovar com a mensalidade em dia só faltando poucos dias para vencer. */
export const RENEW_WINDOW_DAYS = 10;

/** Fim (inclusive) do ciclo `n` (1 = primeiro): sempre contado a partir da âncora, nunca "deriva" em meses curtos. */
export function cycleEnd(anchor: IsoDate, n: number): IsoDate {
  return addDays(addMonthsFrom(anchor, n), -1);
}

/** Começo do ciclo de índice `i` (0 = primeiro). */
export function cycleStart(anchor: IsoDate, i: number): IsoDate {
  return addMonthsFrom(anchor, i);
}

/** `anchor` + n meses, mantendo o dia da âncora (limitado ao último dia do mês). */
export function addMonthsFrom(anchor: IsoDate, n: number): IsoDate {
  return dayOfMonth(addMonths(monthOf(anchor), n), Number(anchor.slice(8)));
}

/** Ciclo (mensalidade) que contém `today`, contado a partir da âncora; antes da âncora = o primeiro. */
export function currentCycle(anchor: IsoDate, today: IsoDate): { start: IsoDate; end: IsoDate; index: number } {
  let index = 0;
  while (cycleStart(anchor, index + 1) <= today && index < 1200) index++;
  return { start: cycleStart(anchor, index), end: cycleEnd(anchor, index + 1), index };
}

export function membershipState(m: { status: MembershipStatus; paidThrough: IsoDate | null }, today: IsoDate): MembershipState {
  if (m.status === 'CANCELADA') return 'CANCELADA';
  if (m.status === 'PAUSADA') return 'PAUSADA';
  return m.paidThrough && today <= m.paidThrough ? 'EM_DIA' : 'VENCIDA';
}

/** Pode usar uma sessão agora? Em dia e, se o plano limita por mês, ainda com saldo no ciclo atual. */
export function membershipCanUse(state: MembershipState, sessionsPerMonth: number | null, usedInCycle: number): boolean {
  return state === 'EM_DIA' && (sessionsPerMonth === null || usedInCycle < sessionsPerMonth);
}

export interface RenewalResult {
  anchor: IsoDate;
  cyclesPaid: number;
  paidThrough: IsoDate;
}

/**
 * Pagou a mensalidade. Primeira vez, ou vencida: recomeça hoje. Em dia: acrescenta um ciclo (só se faltam
 * até `RENEW_WINDOW_DAYS` para vencer; antes disso devolve `null` — já está pago).
 */
export function renewMembership(m: { anchor: IsoDate | null; cyclesPaid: number; paidThrough: IsoDate | null }, today: IsoDate): RenewalResult | null {
  if (!m.anchor || !m.paidThrough || today > m.paidThrough) return { anchor: today, cyclesPaid: 1, paidThrough: cycleEnd(today, 1) };
  if (m.paidThrough > addDays(today, RENEW_WINDOW_DAYS)) return null;
  const cyclesPaid = m.cyclesPaid + 1;
  return { anchor: m.anchor, cyclesPaid, paidThrough: cycleEnd(m.anchor, cyclesPaid) };
}

// ------------------------------------------------------------------ vale-presente

export const GIFT_VALIDITY_DAYS = 365;
/** Sem 0/O/1/I/L: o código é lido em voz alta e digitado à mão. */
const GIFT_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** XXXX-XXXX-XXXX. `random` devolve inteiros em [0, n): em produção, `crypto.randomInt`. */
export function generateGiftCode(random: (n: number) => number): string {
  const part = () => Array.from({ length: 4 }, () => GIFT_ALPHABET[random(GIFT_ALPHABET.length)]).join('');
  return `${part()}-${part()}-${part()}`;
}

/** Aceita minúsculas, espaços e sem hífens; devolve o formato canônico (ou null se não parece um código). */
export function normalizeGiftCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 12) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export type GiftCardStatus = 'ATIVO' | 'USADO' | 'EXPIRADO';
export const GIFT_STATUS_LABEL: Record<GiftCardStatus, string> = { ATIVO: 'Com saldo', USADO: 'Usado', EXPIRADO: 'Vencido' };

export function giftCardStatus(g: { balanceCents: number; expiresAt: IsoDate }, today: IsoDate): GiftCardStatus {
  if (g.balanceCents <= 0) return 'USADO';
  return today > g.expiresAt ? 'EXPIRADO' : 'ATIVO';
}

// ------------------------------------------------------------------ fidelidade

export interface LoyaltyRule {
  enabled: boolean;
  /** Pontos por R$ 1,00 pago. */
  pointsPerReal: number;
  /** Quantos pontos formam um resgate… */
  redeemPoints: number;
  /** …e quanto cada resgate abate (centavos). */
  redeemValueCents: number;
}

export const DEFAULT_LOYALTY: LoyaltyRule = { enabled: false, pointsPerReal: 1, redeemPoints: 100, redeemValueCents: 1000 };

export const loyaltyOf = (saved: Partial<LoyaltyRule> | null | undefined): LoyaltyRule => ({ ...DEFAULT_LOYALTY, ...(saved ?? {}) });

export function validateLoyalty(r: LoyaltyRule): string | null {
  if (!Number.isInteger(r.pointsPerReal) || r.pointsPerReal < 1 || r.pointsPerReal > 100) return 'Pontos por real: de 1 a 100';
  if (!Number.isInteger(r.redeemPoints) || r.redeemPoints < 1 || r.redeemPoints > 100_000) return 'Pontos por resgate: de 1 a 100.000';
  if (!Number.isInteger(r.redeemValueCents) || r.redeemValueCents < 1) return 'O desconto do resgate precisa ser maior que zero';
  return null;
}

/** Pontos ganhos por um valor pago (centavos); frações de real não contam. */
export const pointsEarned = (paidCents: number, rule: Pick<LoyaltyRule, 'pointsPerReal'>) =>
  Math.max(0, Math.floor((paidCents * rule.pointsPerReal) / 100));

/** Quantos pontos o cliente pode gastar de fato (só em múltiplos de um resgate) e o desconto que isso dá. */
export function redeemable(balance: number, rule: LoyaltyRule, maxDiscountCents: number): { points: number; discountCents: number } {
  const byBalance = Math.floor(balance / rule.redeemPoints);
  const byValue = Math.floor(Math.max(0, maxDiscountCents) / rule.redeemValueCents);
  const units = Math.max(0, Math.min(byBalance, byValue));
  return { points: units * rule.redeemPoints, discountCents: units * rule.redeemValueCents };
}

// ------------------------------------------------------------------ avaliações

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export function ratingSummary(ratings: number[]): { count: number; averageTimes10: number } {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= MIN_RATING && r <= MAX_RATING);
  return { count: valid.length, averageTimes10: valid.length ? Math.round((valid.reduce((s, r) => s + r, 0) * 10) / valid.length) : 0 };
}

/** 47 → "4,7". */
export const formatRating = (averageTimes10: number) => (averageTimes10 / 10).toFixed(1).replace('.', ',');

/** Nome para o público (painel de TV, avaliações): "Ana S." — nunca o nome inteiro. */
export function publicName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ------------------------------------------------------------------ DTOs — pacotes

export interface PackagePlanDto {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  sessions: number;
  priceCents: number;
  validityDays: number | null;
  active: boolean;
}

export interface PackagePlanInput {
  name: string;
  serviceId: string;
  sessions: number;
  priceCents: number;
  validityDays?: number | null;
}

export type UpdatePackagePlanRequest = Partial<Omit<PackagePlanInput, 'serviceId'>> & { active?: boolean };

export interface ClientPackageDto {
  id: string;
  clientId: string;
  clientName: string;
  planName: string;
  serviceId: string;
  serviceName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsLeft: number;
  priceCents: number;
  purchasedAt: IsoDate;
  expiresAt: IsoDate | null;
  status: PackageStatus;
}

// ------------------------------------------------------------------ DTOs — clube

export interface MembershipPlanDto {
  id: string;
  name: string;
  priceCents: number;
  /** null = vale para qualquer serviço. */
  serviceId: string | null;
  serviceName: string | null;
  /** null = ilimitado. */
  sessionsPerMonth: number | null;
  active: boolean;
}

export interface MembershipPlanInput {
  name: string;
  priceCents: number;
  serviceId?: string | null;
  sessionsPerMonth?: number | null;
}

export type UpdateMembershipPlanRequest = Partial<Omit<MembershipPlanInput, 'serviceId'>> & { active?: boolean };

export interface ClientMembershipDto {
  id: string;
  clientId: string;
  clientName: string;
  planId: string;
  planName: string;
  priceCents: number;
  serviceId: string | null;
  serviceName: string | null;
  sessionsPerMonth: number | null;
  status: MembershipStatus;
  state: MembershipState;
  paidThrough: IsoDate | null;
  cycle: { start: IsoDate; end: IsoDate } | null;
  sessionsUsedInCycle: number;
  /** Pode usar uma sessão agora. */
  canUse: boolean;
}

// ------------------------------------------------------------------ DTOs — vale-presente

export interface GiftCardDto {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  expiresAt: IsoDate;
  status: GiftCardStatus;
  buyerName: string | null;
  orderNumber: number | null;
  createdAt: string;
}

// ------------------------------------------------------------------ DTOs — fidelidade

export interface LoyaltyEntryDto {
  id: string;
  points: number;
  reason: string;
  orderNumber: number | null;
  createdAt: string;
}

export interface LoyaltyBalanceDto {
  enabled: boolean;
  rule: LoyaltyRule;
  balance: number;
  entries: LoyaltyEntryDto[];
}

export interface RedeemPointsRequest {
  /** Pontos a gastar (múltiplos de um resgate); 0 desfaz o resgate da comanda. */
  points: number;
}

// ------------------------------------------------------------------ DTOs — avaliações

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  clientName: string;
  memberName: string | null;
  serviceName: string | null;
  published: boolean;
  createdAt: string;
}

export interface ReviewsDto {
  summary: { count: number; averageTimes10: number };
  items: ReviewDto[];
}

export interface ReviewRequestDto {
  /** Código do link (só aparece agora). */
  token: string;
  path: string;
  /** Mensagem pronta para o WhatsApp. */
  message: string;
}

export interface PublicReviewInfoDto {
  organizationName: string;
  professionalName: string | null;
  serviceName: string | null;
  answered: boolean;
}

export interface SubmitReviewRequest {
  rating: number;
  comment?: string | null;
}

export interface PublicReviewDto {
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
}

// ------------------------------------------------------------------ painel de TV

export interface TvEntryDto {
  id: string;
  /** "Ana S." */
  name: string;
  professionalName: string;
  startsAt: string;
  calledAt: string | null;
}

export interface TvBoardDto {
  organizationName: string;
  timezone: string;
  now: string;
  /** Chamados há pouco (até 2 minutos), do mais recente. */
  calling: TvEntryDto[];
  /** Chegaram e aguardam. */
  waiting: TvEntryDto[];
  inService: TvEntryDto[];
  /** Próximos horários do dia. */
  next: TvEntryDto[];
}

/** Por quanto tempo uma chamada fica em destaque no painel. */
export const CALL_HIGHLIGHT_SECONDS = 120;
