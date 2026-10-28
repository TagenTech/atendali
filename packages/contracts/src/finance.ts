/**
 * Comanda, formas de pagamento, comissões e caixa — regras puras (centavos, sem arredondamento perdido).
 * Taxas e percentuais em pontos-base (bps): 100 bps = 1%. 349 bps = 3,49%.
 */
import { PaymentMethod } from './enums';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
  VALE_PRESENTE: 'Vale-presente',
};

export const PAYMENT_METHODS = Object.values(PaymentMethod);

/** Configuração de cada forma de pagamento no negócio (taxa da maquininha, prazo de recebimento). */
export interface PaymentMethodConfig {
  method: PaymentMethod;
  enabled: boolean;
  /** Taxa percentual em bps. */
  feeBps: number;
  /** Taxa fixa por transação (centavos). */
  feeFixedCents: number;
  /** Em quantos dias o dinheiro cai (D+N). */
  settlementDays: number;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { method: 'PIX', enabled: true, feeBps: 0, feeFixedCents: 0, settlementDays: 0 },
  { method: 'DINHEIRO', enabled: true, feeBps: 0, feeFixedCents: 0, settlementDays: 0 },
  { method: 'CARTAO_DEBITO', enabled: true, feeBps: 199, feeFixedCents: 0, settlementDays: 1 },
  { method: 'CARTAO_CREDITO', enabled: true, feeBps: 349, feeFixedCents: 0, settlementDays: 30 },
  { method: 'TRANSFERENCIA', enabled: false, feeBps: 0, feeFixedCents: 0, settlementDays: 0 },
  { method: 'OUTRO', enabled: false, feeBps: 0, feeFixedCents: 0, settlementDays: 0 },
];

/** Completa a configuração salva com as formas que faltarem (na ordem padrão). */
export function paymentMethodsOf(saved: PaymentMethodConfig[] | null | undefined): PaymentMethodConfig[] {
  return DEFAULT_PAYMENT_METHODS.map((d) => saved?.find((s) => s.method === d.method) ?? d);
}

export const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Taxa cobrada pela forma de pagamento (nunca maior que o valor). */
export function paymentFee(amountCents: number, cfg: Pick<PaymentMethodConfig, 'feeBps' | 'feeFixedCents'>): number {
  if (amountCents <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * cfg.feeBps) / 10_000) + cfg.feeFixedCents);
}

// ------------------------------------------------------------------ comanda

export const OrderStatus = {
  ABERTA: 'ABERTA',
  FECHADA: 'FECHADA',
  CANCELADA: 'CANCELADA',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { ABERTA: 'Aberta', FECHADA: 'Paga', CANCELADA: 'Cancelada' };

export const OrderItemKind = {
  SERVICO: 'SERVICO',
  AVULSO: 'AVULSO',
  /** Produto do estoque (baixa no fechamento). */
  PRODUTO: 'PRODUTO',
  /** Venda de um pacote de sessões (cria o saldo do cliente no fechamento). */
  PACOTE: 'PACOTE',
  /** Mensalidade do clube (renova a assinatura no fechamento). */
  CLUBE: 'CLUBE',
  /** Venda de vale-presente (gera o código no fechamento). Não é receita: vira receita quando o vale é usado. */
  VALE: 'VALE',
  /** Sessão de um pacote do cliente: valor zero, desconta uma sessão. */
  SESSAO_PACOTE: 'SESSAO_PACOTE',
  /** Sessão coberta pela assinatura do clube. */
  SESSAO_CLUBE: 'SESSAO_CLUBE',
} as const;
export type OrderItemKind = (typeof OrderItemKind)[keyof typeof OrderItemKind];

export interface ItemLike {
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
}

export const itemGross = (i: ItemLike) => i.quantity * i.unitPriceCents;
export const itemNet = (i: ItemLike) => Math.max(0, itemGross(i) - i.discountCents);

/**
 * Reparte um valor (ex.: desconto da comanda) entre partes proporcionais, sem perder centavo:
 * maiores restos recebem o centavo que sobra. Soma sempre igual a `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k].i]++;
  return out;
}

export interface OrderTotals {
  /** Soma bruta dos itens. */
  subtotalCents: number;
  /** Descontos dos itens + desconto da comanda. */
  discountCents: number;
  totalCents: number;
  paidCents: number;
  /** Quanto falta receber (0 quando quitada). */
  dueCents: number;
  /** Valor líquido de cada item depois de repartir o desconto da comanda (base da comissão). */
  itemNetCents: number[];
}

export function orderTotals(items: ItemLike[], orderDiscountCents: number, payments: { amountCents: number }[] = []): OrderTotals {
  const nets = items.map(itemNet);
  const itemsNet = nets.reduce((s, v) => s + v, 0);
  const orderDiscount = Math.min(Math.max(0, orderDiscountCents), itemsNet);
  const shares = allocate(orderDiscount, nets);
  const subtotalCents = items.reduce((s, i) => s + itemGross(i), 0);
  const totalCents = itemsNet - orderDiscount;
  const paidCents = payments.reduce((s, p) => s + p.amountCents, 0);
  return {
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
    paidCents,
    dueCents: Math.max(0, totalCents - paidCents),
    itemNetCents: nets.map((n, i) => n - shares[i]),
  };
}

/** Troco do dinheiro: recebido além do que falta. */
export const changeFor = (receivedCents: number, dueCents: number) => Math.max(0, receivedCents - dueCents);

// ------------------------------------------------------------------ comissão

export const CommissionBase = {
  /** Sobre o valor do serviço (já com descontos). */
  BRUTO: 'BRUTO',
  /** Descontando a parte proporcional das taxas de pagamento. */
  LIQUIDO: 'LIQUIDO',
} as const;
export type CommissionBase = (typeof CommissionBase)[keyof typeof CommissionBase];

/** Percentual que vale: o do serviço (se tiver) > o do profissional > 0. */
export function commissionRate(serviceBps: number | null | undefined, memberBps: number | null | undefined): number {
  return serviceBps ?? memberBps ?? 0;
}

/**
 * Comissão por item da comanda. Na base LÍQUIDA, as taxas dos pagamentos são repartidas
 * entre os itens na proporção do valor de cada um.
 */
export function commissionsFor(
  items: { netCents: number; bps: number; memberId: string | null }[],
  base: CommissionBase,
  totalFeesCents: number,
): { baseCents: number; amountCents: number }[] {
  const feeShares = base === 'LIQUIDO' ? allocate(totalFeesCents, items.map((i) => i.netCents)) : items.map(() => 0);
  return items.map((i, k) => {
    const baseCents = Math.max(0, i.netCents - feeShares[k]);
    return { baseCents, amountCents: i.memberId ? Math.round((baseCents * i.bps) / 10_000) : 0 };
  });
}

// ------------------------------------------------------------------ caixa

export const CashMovementKind = {
  SANGRIA: 'SANGRIA',
  SUPRIMENTO: 'SUPRIMENTO',
} as const;
export type CashMovementKind = (typeof CashMovementKind)[keyof typeof CashMovementKind];

/** Conferência: quanto deveria ter em cada forma; em dinheiro soma abertura e suprimentos e tira sangrias. */
export function cashExpected(p: {
  openingCents: number;
  payments: { method: PaymentMethod; amountCents: number }[];
  movements: { kind: CashMovementKind; amountCents: number }[];
}): { byMethod: Record<PaymentMethod, number>; drawerCents: number } {
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<PaymentMethod, number>;
  for (const pay of p.payments) byMethod[pay.method] += pay.amountCents;
  const moves = p.movements.reduce((s, m) => s + (m.kind === 'SUPRIMENTO' ? m.amountCents : -m.amountCents), 0);
  return { byMethod, drawerCents: p.openingCents + byMethod.DINHEIRO + moves };
}

// ------------------------------------------------------------------ DTOs

export interface OrderItemDto {
  id: string;
  kind: OrderItemKind;
  description: string;
  serviceId: string | null;
  memberId: string | null;
  memberName: string | null;
  appointmentId: string | null;
  /** Produto, plano, pacote/assinatura do cliente — conforme o tipo do item. */
  refId: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  netCents: number;
}

export interface OrderPaymentDto {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  feeCents: number;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  /** Número sequencial da comanda no negócio. */
  number: number;
  status: OrderStatus;
  clientId: string | null;
  clientName: string | null;
  items: OrderItemDto[];
  payments: OrderPaymentDto[];
  discountCents: number;
  /** Resgate de pontos de fidelidade nesta comanda (já incluído nos totais). */
  loyalty: { redeemedPoints: number; discountCents: number };
  totals: Omit<OrderTotals, 'itemNetCents'> & { feesCents: number };
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface OrderSummaryDto {
  id: string;
  number: number;
  status: OrderStatus;
  clientName: string | null;
  totalCents: number;
  paidCents: number;
  openedAt: string;
  closedAt: string | null;
}

export interface CreateOrderRequest {
  clientId?: string | null;
  /** Abre a comanda já com os serviços desses agendamentos (check-in). */
  appointmentIds?: string[];
}

export interface OrderItemInput {
  kind: OrderItemKind;
  serviceId?: string | null;
  /** Produto (PRODUTO), plano (PACOTE/CLUBE) ou pacote/assinatura do cliente (SESSAO_*). */
  refId?: string | null;
  description?: string;
  memberId?: string | null;
  quantity?: number;
  unitPriceCents?: number;
  discountCents?: number;
}

export interface UpdateOrderRequest {
  clientId?: string | null;
  discountCents?: number;
  notes?: string | null;
}

export interface AddPaymentRequest {
  method: PaymentMethod;
  amountCents: number;
  /** Código do vale-presente (só com VALE_PRESENTE). */
  giftCode?: string | null;
}

export interface CashSessionDto {
  id: string;
  status: 'ABERTO' | 'FECHADO';
  openedAt: string;
  openedByName: string;
  openingCents: number;
  closedAt: string | null;
  closedByName: string | null;
  countedCents: number | null;
  movements: { id: string; kind: CashMovementKind; amountCents: number; note: string | null; createdAt: string }[];
  expected: { byMethod: Record<PaymentMethod, number>; drawerCents: number };
  /** Contado − esperado na gaveta (só no fechamento). */
  differenceCents: number | null;
  openOrders: number;
}

export interface OpenCashRequest {
  openingCents: number;
}

export interface CashMovementRequest {
  kind: CashMovementKind;
  amountCents: number;
  note?: string | null;
}

export interface CloseCashRequest {
  countedCents: number;
  notes?: string | null;
}

export interface CommissionEntryDto {
  id: string;
  memberId: string;
  memberName: string;
  orderNumber: number;
  description: string;
  baseCents: number;
  bps: number;
  amountCents: number;
  createdAt: string;
  payoutId: string | null;
}

export interface AdvanceDto {
  id: string;
  memberId: string;
  memberName: string;
  amountCents: number;
  note: string | null;
  date: string;
  payoutId: string | null;
}

export interface CommissionPayoutDto {
  id: string;
  memberId: string;
  memberName: string;
  commissionsCents: number;
  advancesCents: number;
  totalCents: number;
  entries: number;
  createdAt: string;
}

/** Saldo de comissão em aberto por profissional. */
export interface CommissionBalanceDto {
  memberId: string;
  memberName: string;
  commissionsCents: number;
  advancesCents: number;
  balanceCents: number;
  entries: number;
}

export interface FinanceSummaryDto {
  from: string;
  to: string;
  orders: number;
  grossCents: number;
  discountsCents: number;
  revenueCents: number;
  feesCents: number;
  netCents: number;
  commissionsCents: number;
  averageTicketCents: number;
  byMethod: { method: PaymentMethod; amountCents: number; feesCents: number }[];
  byProfessional: { memberId: string; name: string; revenueCents: number; commissionsCents: number; items: number }[];
  byService: { name: string; revenueCents: number; quantity: number }[];
  byDay: { date: string; revenueCents: number }[];
}
