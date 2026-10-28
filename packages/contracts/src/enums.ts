/** Enums do domínio — compartilhados entre API e web. */

export const PaymentMethod = {
  PIX: 'PIX',
  DINHEIRO: 'DINHEIRO',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  OUTRO: 'OUTRO',
  /** Abate o saldo de um vale-presente (não passa pela maquininha nem entra no caixa). */
  VALE_PRESENTE: 'VALE_PRESENTE',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PixKeyType = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'EMAIL',
  TELEFONE: 'TELEFONE',
  ALEATORIA: 'ALEATORIA',
} as const;
export type PixKeyType = (typeof PixKeyType)[keyof typeof PixKeyType];
