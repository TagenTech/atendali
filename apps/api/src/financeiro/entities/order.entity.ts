import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { OrderStatus } from '@agendei/contracts';
import { Client } from '../../agenda/entities/client.entity';

/** Comanda: o que o cliente consumiu e como pagou. */
@Entity('orders')
@Index(['organizationId', 'number'], { unique: true })
@Index(['organizationId', 'status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  /** Sequencial por negócio (comanda nº 42). */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 12 })
  status: OrderStatus;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  /** Desconto na comanda inteira (além dos descontos por item). */
  @Column({ name: 'discount_cents', type: 'int', default: 0 })
  discountCents: number;

  /** Pontos de fidelidade gastos nesta comanda e o desconto que renderam. */
  @Column({ name: 'points_redeemed', type: 'int', default: 0 })
  pointsRedeemed: number;

  @Column({ name: 'points_discount_cents', type: 'int', default: 0 })
  pointsDiscountCents: number;

  /** Desconto da comanda inteira: o manual + o resgate de pontos. */
  get totalDiscountCents(): number {
    return this.discountCents + this.pointsDiscountCents;
  }

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @Column({ name: 'opened_by_member_id', type: 'uuid' })
  openedByMemberId: string;

  @CreateDateColumn({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Index()
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}
