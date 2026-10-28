import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organization.entity';

/** Serviço/procedimento do catálogo (o nome "Service" fica para as classes do Nest). */
@Entity('services')
export class ServiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 600, nullable: true })
  description: string | null;

  @Column({ name: 'duration_minutes', type: 'smallint' })
  durationMinutes: number;

  /** Centavos. */
  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'online_booking', default: true })
  onlineBooking: boolean;

  /** Comissão deste serviço em bps (null = a do profissional). */
  @Column({ name: 'commission_bps', type: 'int', nullable: true })
  commissionBps: number | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
