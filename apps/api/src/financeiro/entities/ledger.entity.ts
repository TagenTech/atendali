import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { CategoryType, PaymentMethod, ReceivableSource } from '@agendei/contracts';
import { Organization } from '../../organizations/entities/organization.entity';
import { OrderPayment } from './order-payment.entity';

/** Plano de contas: categorias de despesa e de receita (padrão por segmento, editável). */
@Entity('finance_categories')
export class FinanceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 8 })
  type: CategoryType;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Conta bancária ou carteira onde o dinheiro entra e sai. */
@Entity('finance_accounts')
export class FinanceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 80 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Conta a pagar. O status (pendente/pago/atrasado) é calculado das datas, nunca gravado. */
@Entity('payables')
@Index(['organizationId', 'dueDate'])
export class Payable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 160 })
  description: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => FinanceCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: FinanceCategory | null;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate: string | null;

  @Column({ name: 'paid_method', type: 'varchar', length: 16, nullable: true })
  paidMethod: PaymentMethod | null;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => FinanceAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account: FinanceAccount | null;

  /** Parcelas de uma recorrência mensal compartilham o id. */
  @Column({ name: 'recurrence_id', type: 'uuid', nullable: true })
  recurrenceId: string | null;

  @Column({ type: 'int', nullable: true })
  installment: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * Conta a receber: nasce de cada pagamento de comanda (data prevista = pagamento + D+N da forma) ou é lançada à mão.
 * `amountCents` é o que cai na conta, já sem a taxa.
 */
@Entity('receivables')
@Index(['organizationId', 'expectedDate'])
export class Receivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 160 })
  description: string;

  @Column({ type: 'varchar', length: 8 })
  source: ReceivableSource;

  /** Pagamento de comanda que originou (some junto se o pagamento for estornado). */
  @Index({ unique: true })
  @Column({ name: 'order_payment_id', type: 'uuid', nullable: true })
  orderPaymentId: string | null;

  @ManyToOne(() => OrderPayment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'order_payment_id' })
  orderPayment: OrderPayment | null;

  @Column({ name: 'order_number', type: 'int', nullable: true })
  orderNumber: number | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => FinanceCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: FinanceCategory | null;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ name: 'fee_cents', type: 'int', default: 0 })
  feeCents: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  method: PaymentMethod | null;

  @Column({ name: 'expected_date', type: 'date' })
  expectedDate: string;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate: string | null;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => FinanceAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account: FinanceAccount | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
