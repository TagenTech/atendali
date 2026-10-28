import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { CashMovementKind } from '@skedulei/contracts';

/** Sangria (tira dinheiro da gaveta) ou suprimento (põe troco). */
@Entity('cash_movements')
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar', length: 12 })
  kind: CashMovementKind;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
