import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

/** Pedido de avaliação (criado com o link) e, depois que o cliente responde, a avaliação. */
@Entity('reviews')
@Index(['organizationId', 'answeredAt'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  /** Nome do cliente no momento (fica mesmo se o cadastro for apagado — já sem identificação). */
  @Column({ name: 'client_name', type: 'varchar', length: 120, nullable: true })
  clientName: string | null;

  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId: string | null;

  @Column({ name: 'member_name', type: 'varchar', length: 120, nullable: true })
  memberName: string | null;

  @Column({ name: 'service_name', type: 'varchar', length: 160, nullable: true })
  serviceName: string | null;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'smallint', nullable: true })
  rating: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @Column({ default: true })
  published: boolean;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
