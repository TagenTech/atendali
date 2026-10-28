/**
 * Trilha de auditoria do negócio: quem fez o quê no dinheiro e nos dados sensíveis (estorno, desconto, caixa, comissão…).
 * Gravada na MESMA transação da ação (se a ação não acontece, o registro também não), nunca editada. Só o dono lê.
 */
export const AUDIT_ACTIONS = [
  'ORDER_CANCELLED',
  'ORDER_DISCOUNT',
  'ORDER_ITEM_REMOVED',
  'PAYMENT_REMOVED',
  'CASH_OPENED',
  'CASH_MOVEMENT',
  'CASH_CLOSED',
  'COMMISSION_PAID',
  'ADVANCE_ADDED',
  'PAYABLE_PAID',
  'PAYABLE_REOPENED',
  'PAYABLE_REMOVED',
  'RECEIVABLE_SETTLED',
  'RECEIVABLE_REOPENED',
  'RECEIVABLE_REMOVED',
  'CLIENT_ANONYMIZED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  ORDER_CANCELLED: 'Comanda cancelada/estornada',
  ORDER_DISCOUNT: 'Desconto na comanda',
  ORDER_ITEM_REMOVED: 'Item removido da comanda',
  PAYMENT_REMOVED: 'Pagamento desfeito',
  CASH_OPENED: 'Caixa aberto',
  CASH_MOVEMENT: 'Sangria ou suprimento',
  CASH_CLOSED: 'Caixa fechado',
  COMMISSION_PAID: 'Comissão paga',
  ADVANCE_ADDED: 'Vale (adiantamento) lançado',
  PAYABLE_PAID: 'Conta a pagar paga',
  PAYABLE_REOPENED: 'Conta a pagar reaberta',
  PAYABLE_REMOVED: 'Conta a pagar apagada',
  RECEIVABLE_SETTLED: 'Recebimento dado como recebido',
  RECEIVABLE_REOPENED: 'Recebimento reaberto',
  RECEIVABLE_REMOVED: 'Receita apagada',
  CLIENT_ANONYMIZED: 'Cliente excluído (anonimizado)',
};

export const AUDIT_GROUPS = {
  COMANDAS: { label: 'Comandas', actions: ['ORDER_CANCELLED', 'ORDER_DISCOUNT', 'ORDER_ITEM_REMOVED', 'PAYMENT_REMOVED'] },
  CAIXA: { label: 'Caixa', actions: ['CASH_OPENED', 'CASH_MOVEMENT', 'CASH_CLOSED'] },
  COMISSOES: { label: 'Comissões', actions: ['COMMISSION_PAID', 'ADVANCE_ADDED'] },
  CONTAS: { label: 'Contas', actions: ['PAYABLE_PAID', 'PAYABLE_REOPENED', 'PAYABLE_REMOVED', 'RECEIVABLE_SETTLED', 'RECEIVABLE_REOPENED', 'RECEIVABLE_REMOVED'] },
  CLIENTES: { label: 'Clientes', actions: ['CLIENT_ANONYMIZED'] },
} as const satisfies Record<string, { label: string; actions: readonly AuditAction[] }>;
export type AuditGroup = keyof typeof AUDIT_GROUPS;
export const AUDIT_GROUP_KEYS = Object.keys(AUDIT_GROUPS) as AuditGroup[];

export interface AuditEntryDto {
  id: string;
  action: AuditAction;
  /** Frase pronta: "Comanda #12 cancelada (R$ 280,00, já paga)". */
  summary: string;
  actorName: string;
  actorRole: string | null;
  createdAt: string;
}

export interface AuditQuery {
  grupo?: AuditGroup;
  /** Quantos dias para trás (padrão 30, até 365). */
  dias?: number;
}
