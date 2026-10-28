import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { PaymentMethod } from '@agendei/contracts';
import { Order } from './order.entity';

/** Pagamento de uma comanda (vários por comanda: parte no PIX, parte no cartão). */
@Entity('order_payments')
export class OrderPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Caixa em que entrou. */
  @Index()
  @Column({ name: 'cash_session_id', type: 'uuid' })
  cashSessionId: string;

  @Column({ type: 'varchar', length: 16 })
  method: PaymentMethod;

  /** Vale-presente usado (quando o método é VALE_PRESENTE). */
  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  /** Taxa da forma de pagamento no momento (maquininha). */
  @Column({ name: 'fee_cents', type: 'int', default: 0 })
  feeCents: number;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
