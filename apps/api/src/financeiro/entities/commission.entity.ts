import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Member } from '../../organizations/entities/member.entity';
import { Order } from './order.entity';

/** Comissão gerada ao fechar a comanda (uma por item com profissional). */
@Entity('commission_entries')
@Index(['organizationId', 'memberId', 'payoutId'])
export class CommissionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @Column({ length: 160 })
  description: string;

  @Column({ name: 'base_cents', type: 'int' })
  baseCents: number;

  @Column({ type: 'int' })
  bps: number;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  /** Fechamento em que foi paga (null = em aberto). */
  @Column({ name: 'payout_id', type: 'uuid', nullable: true })
  payoutId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Vale/adiantamento: descontado no próximo fechamento de comissão. */
@Entity('commission_advances')
export class Advance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'payout_id', type: 'uuid', nullable: true })
  payoutId: string | null;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Fechamento: junta comissões em aberto, desconta vales, registra o valor pago ao profissional. */
@Entity('commission_payouts')
export class CommissionPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'commissions_cents', type: 'int' })
  commissionsCents: number;

  @Column({ name: 'advances_cents', type: 'int' })
  advancesCents: number;

  @Column({ name: 'total_cents', type: 'int' })
  totalCents: number;

  @Column({ type: 'int' })
  entries: number;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
