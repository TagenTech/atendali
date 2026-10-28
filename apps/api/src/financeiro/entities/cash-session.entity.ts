import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Member } from '../../organizations/entities/member.entity';

/** Caixa da unidade: aberto com um troco inicial, fechado com a conferência do dinheiro. Um aberto por unidade. */
@Entity('cash_sessions')
@Index(['organizationId', 'unitId'], { unique: true, where: '"closed_at" IS NULL' })
export class CashSession {
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

  @Column({ name: 'opened_by_member_id', type: 'uuid' })
  openedByMemberId: string;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'opened_by_member_id' })
  openedBy: Member;

  @CreateDateColumn({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  /** Troco inicial na gaveta (centavos). */
  @Column({ name: 'opening_cents', type: 'int' })
  openingCents: number;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by_member_id', type: 'uuid', nullable: true })
  closedByMemberId: string | null;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'closed_by_member_id' })
  closedBy: Member | null;

  /** Dinheiro contado na gaveta no fechamento. */
  @Column({ name: 'counted_cents', type: 'int', nullable: true })
  countedCents: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;
}
