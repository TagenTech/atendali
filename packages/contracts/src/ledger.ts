/**
 * Contas a pagar/receber, DRE gerencial e fluxo de caixa — regras puras (centavos, datas 'YYYY-MM-DD').
 * Status (pendente, pago, atrasado…) são sempre calculados a partir das datas, nunca gravados.
 */
import { addDays, type IsoDate } from './dates';
import { PaymentMethod } from './enums';
import type { Segment } from './segments';
import { addMonths, dayOfMonth, monthOf, startOfWeek } from './time';

// ------------------------------------------------------------------ plano de contas

export type CategoryType = 'DESPESA' | 'RECEITA';

const COMMON_EXPENSES = [
  'Aluguel e condomínio',
  'Água, luz e internet',
  'Salários e encargos',
  'Pró-labore',
  'Impostos e taxas',
  'Fornecedores e produtos',
  'Marketing',
  'Contabilidade',
  'Manutenção e limpeza',
  'Outras despesas',
];

const SEGMENT_EXPENSES: Record<Segment, string[]> = {
  SALAO_BELEZA: ['Produtos de cabelo e química'],
  BARBEARIA: ['Produtos e lâminas'],
  ESTETICA: ['Cosméticos e insumos', 'Manutenção de equipamentos'],
  CLINICA_MEDICA: ['Materiais descartáveis', 'Convênios e repasses', 'Software e prontuário'],
  ODONTOLOGIA: ['Materiais odontológicos', 'Laboratório de prótese', 'Convênios e repasses'],
  TERAPIAS: ['Supervisão e cursos'],
  OUTRO: [],
};

const COMMON_REVENUES = ['Serviços', 'Venda de produtos', 'Outras receitas'];

/** Plano de contas inicial por segmento — o negócio edita depois (renomear, incluir, desativar). */
export function defaultChartOfAccounts(segment: Segment): { name: string; type: CategoryType }[] {
  const expenses = [...COMMON_EXPENSES.slice(0, -1), ...(SEGMENT_EXPENSES[segment] ?? []), COMMON_EXPENSES[COMMON_EXPENSES.length - 1]];
  return [...expenses.map((name) => ({ name, type: 'DESPESA' as const })), ...COMMON_REVENUES.map((name) => ({ name, type: 'RECEITA' as const }))];
}

export const DEFAULT_ACCOUNT_NAME = 'Conta principal';

// ------------------------------------------------------------------ status calculado

export type PayableStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO';
export type ReceivableStatus = 'PENDENTE' | 'RECEBIDO' | 'ATRASADO';

export const PAYABLE_STATUS_LABEL: Record<PayableStatus, string> = { PENDENTE: 'A pagar', PAGO: 'Paga', ATRASADO: 'Atrasada' };
export const RECEIVABLE_STATUS_LABEL: Record<ReceivableStatus, string> = { PENDENTE: 'A receber', RECEBIDO: 'Recebida', ATRASADO: 'Atrasada' };

export function payableStatus(p: { dueDate: IsoDate; paidDate: IsoDate | null }, today: IsoDate): PayableStatus {
  if (p.paidDate) return 'PAGO';
  return p.dueDate < today ? 'ATRASADO' : 'PENDENTE';
}

export function receivableStatus(r: { expectedDate: IsoDate; receivedDate: IsoDate | null }, today: IsoDate): ReceivableStatus {
  if (r.receivedDate) return 'RECEBIDO';
  return r.expectedDate < today ? 'ATRASADO' : 'PENDENTE';
}

// ------------------------------------------------------------------ recorrência e prazos

export const RECURRENCE_MAX = 36;

/** Vencimentos mensais a partir do primeiro (dia 31 vira o último dia dos meses curtos, sem "escorregar"). */
export function monthlyDates(first: IsoDate, count: number): IsoDate[] {
  const day = Number(first.slice(8));
  const n = Math.min(Math.max(1, Math.floor(count)), RECURRENCE_MAX);
  return Array.from({ length: n }, (_, k) => dayOfMonth(addMonths(monthOf(first), k), day));
}

/** Quando o dinheiro cai: data do pagamento + D+N da forma de pagamento. */
export const settlementDate = (paidOn: IsoDate, settlementDays: number): IsoDate => addDays(paidOn, Math.max(0, settlementDays));

/** Valor que cai na conta: o pagamento menos a taxa da maquininha. */
export const receivableNet = (amountCents: number, feeCents: number) => Math.max(0, amountCents - feeCents);

// ------------------------------------------------------------------ DRE gerencial

export interface DreInput {
  /** Itens vendidos nas comandas pagas, antes do desconto. */
  salesGrossCents: number;
  /** Receitas avulsas recebidas no período. */
  otherRevenueCents: number;
  discountsCents: number;
  feesCents: number;
  commissionsCents: number;
  /** Contas a pagar pagas no período, por categoria. */
  expenses: { categoryId: string | null; name: string; cents: number }[];
}

export interface Dre {
  grossRevenueCents: number;
  salesGrossCents: number;
  otherRevenueCents: number;
  discountsCents: number;
  feesCents: number;
  netRevenueCents: number;
  commissionsCents: number;
  contributionCents: number;
  /** Margem de contribuição sobre a receita líquida (bps). */
  contributionBps: number;
  fixedExpensesCents: number;
  expensesByCategory: { categoryId: string | null; name: string; cents: number }[];
  resultCents: number;
  /** Resultado sobre a receita líquida (bps). */
  resultBps: number;
}

const ratioBps = (part: number, whole: number) => (whole > 0 ? Math.round((part * 10_000) / whole) : 0);

export function buildDre(i: DreInput): Dre {
  const grossRevenueCents = i.salesGrossCents + i.otherRevenueCents;
  const netRevenueCents = grossRevenueCents - i.discountsCents - i.feesCents;
  const contributionCents = netRevenueCents - i.commissionsCents;
  const merged = new Map<string, { categoryId: string | null; name: string; cents: number }>();
  for (const e of i.expenses) {
    const key = e.categoryId ?? `sem:${e.name}`;
    const cur = merged.get(key) ?? { categoryId: e.categoryId, name: e.name, cents: 0 };
    cur.cents += e.cents;
    merged.set(key, cur);
  }
  const expensesByCategory = [...merged.values()].filter((e) => e.cents !== 0).sort((a, b) => b.cents - a.cents);
  const fixedExpensesCents = expensesByCategory.reduce((s, e) => s + e.cents, 0);
  const resultCents = contributionCents - fixedExpensesCents;
  return {
    grossRevenueCents,
    salesGrossCents: i.salesGrossCents,
    otherRevenueCents: i.otherRevenueCents,
    discountsCents: i.discountsCents,
    feesCents: i.feesCents,
    netRevenueCents,
    commissionsCents: i.commissionsCents,
    contributionCents,
    contributionBps: ratioBps(contributionCents, netRevenueCents),
    fixedExpensesCents,
    expensesByCategory,
    resultCents,
    resultBps: ratioBps(resultCents, netRevenueCents),
  };
}

// ------------------------------------------------------------------ fluxo de caixa

export type FlowBucketSize = 'dia' | 'semana';

export interface FlowEvent {
  date: IsoDate;
  cents: number;
}

export interface FlowBucket {
  /** Primeiro dia do intervalo (dentro do período). */
  start: IsoDate;
  /** Último dia do intervalo (dentro do período). */
  end: IsoDate;
  inCents: number;
  outCents: number;
  netCents: number;
  /** Saldo acumulado até o fim do intervalo (parte do saldo inicial informado). */
  balanceCents: number;
}

export interface CashFlow {
  from: IsoDate;
  to: IsoDate;
  bucket: FlowBucketSize;
  buckets: FlowBucket[];
  inCents: number;
  outCents: number;
  netCents: number;
}

/** Soma entradas e saídas por dia ou semana (segunda a domingo, cortada nas pontas do período). */
export function buildCashFlow(p: {
  from: IsoDate;
  to: IsoDate;
  bucket: FlowBucketSize;
  inflows: FlowEvent[];
  outflows: FlowEvent[];
  openingCents?: number;
}): CashFlow {
  const startOf = (d: IsoDate) => (p.bucket === 'dia' ? d : startOfWeek(d) < p.from ? p.from : startOfWeek(d));
  const buckets: FlowBucket[] = [];
  const index = new Map<IsoDate, FlowBucket>();
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) {
    const s = startOf(d);
    let b = index.get(s);
    if (!b) {
      b = { start: s, end: d, inCents: 0, outCents: 0, netCents: 0, balanceCents: 0 };
      index.set(s, b);
      buckets.push(b);
    }
    b.end = d;
  }
  const put = (events: FlowEvent[], side: 'inCents' | 'outCents') => {
    for (const e of events) {
      if (e.date < p.from || e.date > p.to) continue;
      index.get(startOf(e.date))![side] += e.cents;
    }
  };
  put(p.inflows, 'inCents');
  put(p.outflows, 'outCents');
  let balance = p.openingCents ?? 0;
  for (const b of buckets) {
    b.netCents = b.inCents - b.outCents;
    balance += b.netCents;
    b.balanceCents = balance;
  }
  const inCents = buckets.reduce((s, b) => s + b.inCents, 0);
  const outCents = buckets.reduce((s, b) => s + b.outCents, 0);
  return { from: p.from, to: p.to, bucket: p.bucket, buckets, inCents, outCents, netCents: inCents - outCents };
}

/** Previsto que já passou da data e não foi baixado conta como "hoje" na projeção. */
export const projectedDate = (date: IsoDate, today: IsoDate): IsoDate => (date < today ? today : date);

export const PROJECTION_DAYS = [30, 60, 90] as const;
export type ProjectionDays = (typeof PROJECTION_DAYS)[number];

// ------------------------------------------------------------------ DTOs

export interface FinanceCategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
}

export interface FinanceAccountDto {
  id: string;
  name: string;
  active: boolean;
}

export interface PayableDto {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  amountCents: number;
  dueDate: IsoDate;
  paidDate: IsoDate | null;
  paidMethod: PaymentMethod | null;
  accountId: string | null;
  accountName: string | null;
  /** Presente nas parcelas geradas por uma recorrência mensal. */
  recurrenceId: string | null;
  installment: number | null;
  status: PayableStatus;
  notes: string | null;
}

export interface CreatePayableRequest {
  description: string;
  categoryId?: string | null;
  amountCents: number;
  dueDate: IsoDate;
  /** Repete todo mês (total de parcelas, incluindo esta). */
  monthlyCount?: number | null;
  notes?: string | null;
}

export interface UpdatePayableRequest {
  description?: string;
  categoryId?: string | null;
  amountCents?: number;
  dueDate?: IsoDate;
  notes?: string | null;
}

export interface SettlePayableRequest {
  paidDate: IsoDate;
  method: PaymentMethod;
  accountId?: string | null;
}

export interface PayablesListDto {
  items: PayableDto[];
  totals: { pendingCents: number; overdueCents: number; paidCents: number };
}

export type ReceivableSource = 'COMANDA' | 'AVULSO';

export interface ReceivableDto {
  id: string;
  description: string;
  source: ReceivableSource;
  orderNumber: number | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Valor que cai na conta (já sem a taxa). */
  amountCents: number;
  feeCents: number;
  method: PaymentMethod | null;
  expectedDate: IsoDate;
  receivedDate: IsoDate | null;
  accountId: string | null;
  accountName: string | null;
  status: ReceivableStatus;
  notes: string | null;
}

export interface CreateReceivableRequest {
  description: string;
  categoryId?: string | null;
  amountCents: number;
  expectedDate: IsoDate;
  method?: PaymentMethod | null;
  notes?: string | null;
}

export interface SettleReceivableRequest {
  receivedDate: IsoDate;
  accountId?: string | null;
}

export interface ReceivablesListDto {
  items: ReceivableDto[];
  totals: { pendingCents: number; overdueCents: number; receivedCents: number };
}

export interface DreDto extends Dre {
  from: IsoDate;
  to: IsoDate;
}

export interface CashFlowDto extends CashFlow {
  mode: 'REALIZADO' | 'PROJETADO';
}
