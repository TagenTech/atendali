import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Member } from '../../organizations/entities/member.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';
import { Client } from './client.entity';

/** Cliente esperando vaga. Quando um horário que combina é cancelado, guarda a vaga para a recepção avisar. */
@Entity('waitlist_entries')
@Index(['organizationId', 'resolvedAt'])
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => ServiceItem, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem | null;

  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId: string | null;

  @ManyToOne(() => Member, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'member_id' })
  member: Member | null;

  @Column({ name: 'preferred_date', type: 'date', nullable: true })
  preferredDate: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  /** Último horário cancelado que serve para este pedido. */
  @Column({ name: 'open_slot_starts_at', type: 'timestamptz', nullable: true })
  openSlotStartsAt: Date | null;

  @Column({ name: 'open_slot_member_id', type: 'uuid', nullable: true })
  openSlotMemberId: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
