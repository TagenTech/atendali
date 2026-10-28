/**
 * Estoque: produtos de venda e insumos, movimentações, custo médio e ficha técnica.
 * Quantidades são inteiras na unidade do produto (un, ml, g…); dinheiro em centavos.
 */

export const ProductKind = {
  VENDA: 'VENDA',
  INSUMO: 'INSUMO',
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = { VENDA: 'Produto de venda', INSUMO: 'Insumo (uso interno)' };

export const StockMovementKind = {
  /** Compra / reposição. Atualiza o custo médio. */
  ENTRADA: 'ENTRADA',
  /** Perda, vencimento, uso interno avulso. */
  SAIDA: 'SAIDA',
  /** Inventário: define a quantidade contada. */
  AJUSTE: 'AJUSTE',
  /** Venda na comanda. */
  VENDA: 'VENDA',
  /** Baixa automática pela ficha técnica do serviço. */
  CONSUMO: 'CONSUMO',
  /** Devolve ao estoque quando a comanda é estornada. */
  ESTORNO: 'ESTORNO',
} as const;
export type StockMovementKind = (typeof StockMovementKind)[keyof typeof StockMovementKind];

export const STOCK_MOVEMENT_LABEL: Record<StockMovementKind, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE: 'Inventário',
  VENDA: 'Venda',
  CONSUMO: 'Uso no atendimento',
  ESTORNO: 'Estorno',
};

/** Movimentos que a pessoa lança à mão (os demais vêm da comanda). */
export const MANUAL_MOVEMENTS = ['ENTRADA', 'SAIDA', 'AJUSTE'] as const satisfies readonly StockMovementKind[];
export type ManualMovement = (typeof MANUAL_MOVEMENTS)[number];

export type StockStatus = 'OK' | 'BAIXO' | 'ZERADO';

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = { OK: 'Em dia', BAIXO: 'Abaixo do mínimo', ZERADO: 'Zerado' };

/** Zerado (ou negativo) antes de baixo; "baixo" só quando há mínimo definido. */
export function stockStatus(quantity: number, minQuantity: number): StockStatus {
  if (quantity <= 0) return 'ZERADO';
  if (minQuantity > 0 && quantity <= minQuantity) return 'BAIXO';
  return 'OK';
}

/** Novo custo médio ponderado ao entrar `inQty` a `inCostCents` cada. Estoque zerado/negativo adota o custo da entrada. */
export function averageCost(currentQty: number, currentCostCents: number, inQty: number, inCostCents: number): number {
  if (inQty <= 0) return currentCostCents;
  if (currentQty <= 0) return inCostCents;
  return Math.round((currentQty * currentCostCents + inQty * inCostCents) / (currentQty + inQty));
}

/** Variação da quantidade (com sinal) de cada tipo de movimento, dado o que foi digitado. */
export function movementDelta(kind: StockMovementKind, quantity: number, currentQty: number): number {
  switch (kind) {
    case 'ENTRADA':
    case 'ESTORNO':
      return quantity;
    case 'SAIDA':
    case 'VENDA':
    case 'CONSUMO':
      return -quantity;
    case 'AJUSTE':
      // `quantity` é a quantidade contada: o delta leva o saldo até ela.
      return quantity - currentQty;
  }
}

export type AbcClass = 'A' | 'B' | 'C';

/** Curva ABC: A = itens que somam até 80% do valor, B = até 95%, C = o resto. Valor 0 vai para C. */
export function abcClasses(items: { id: string; valueCents: number }[]): Map<string, AbcClass> {
  const total = items.reduce((s, i) => s + i.valueCents, 0);
  const out = new Map<string, AbcClass>();
  let acc = 0;
  for (const i of [...items].sort((a, b) => b.valueCents - a.valueCents || a.id.localeCompare(b.id))) {
    if (i.valueCents <= 0 || total <= 0) {
      out.set(i.id, 'C');
      continue;
    }
    // Classe pelo acumulado ANTES do item: o primeiro sempre é A.
    out.set(i.id, acc / total < 0.8 ? 'A' : acc / total < 0.95 ? 'B' : 'C');
    acc += i.valueCents;
  }
  return out;
}

export const MAX_STOCK_QUANTITY = 1_000_000;

// ------------------------------------------------------------------ DTOs

export interface ProductDto {
  id: string;
  name: string;
  kind: ProductKind;
  unit: string;
  /** Preço de venda (só para produto de venda). */
  salePriceCents: number | null;
  /** Custo médio por unidade. */
  costCents: number;
  minQuantity: number;
  quantity: number;
  status: StockStatus;
  /** Quantidade × custo médio. */
  valueCents: number;
  active: boolean;
}

export interface ProductInput {
  name: string;
  kind: ProductKind;
  unit?: string;
  salePriceCents?: number | null;
  minQuantity?: number;
  /** Custo inicial por unidade (depois o custo médio é calculado pelas entradas). */
  costCents?: number;
}

export type UpdateProductRequest = Partial<Omit<ProductInput, 'kind'>> & { active?: boolean };

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  kind: StockMovementKind;
  /** Com sinal: entrada +, saída −. */
  quantity: number;
  unitCostCents: number;
  balanceAfter: number;
  note: string | null;
  orderNumber: number | null;
  createdAt: string;
}

export interface CreateMovementRequest {
  productId: string;
  kind: ManualMovement;
  quantity: number;
  /** Custo por unidade da entrada (atualiza o custo médio). */
  unitCostCents?: number;
  note?: string | null;
}

export interface ServiceSupplyDto {
  productId: string;
  productName: string;
  unit: string;
  /** Quanto cada atendimento consome. */
  quantity: number;
}

export interface SetSuppliesRequest {
  supplies: { productId: string; quantity: number }[];
}

export interface StockReportDto {
  totalValueCents: number;
  belowMinimum: number;
  zeroed: number;
  items: (ProductDto & { abc: AbcClass; consumedValueCents: number })[];
}
