import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('gift_cards')
@Index(['organizationId', 'code'], { unique: true })
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 14 })
  code: string;

  @Column({ name: 'initial_cents', type: 'int' })
  initialCents: number;

  @Column({ name: 'balance_cents', type: 'int' })
  balanceCents: number;

  @Column({ name: 'expires_at', type: 'date' })
  expiresAt: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  /** Item da comanda em que foi vendido (para estornar a venda). */
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId: string | null;

  @Column({ name: 'buyer_client_id', type: 'uuid', nullable: true })
  buyerClientId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
