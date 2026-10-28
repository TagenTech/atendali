import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { AppointmentSource, AppointmentStatus } from '@skedulei/contracts';
import { Member } from '../../organizations/entities/member.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';
import { Unit } from '../../organizations/entities/unit.entity';
import { Client } from './client.entity';

@Entity('appointments')
@Index(['organizationId', 'startsAt'])
@Index(['memberId', 'startsAt'])
export class Appointment {
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

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Index()
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => ServiceItem, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 16 })
  status: AppointmentStatus;

  /** Centavos, copiado do serviço ao marcar (reajuste depois não muda o combinado). */
  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ type: 'varchar', length: 600, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 12 })
  source: AppointmentSource;

  /** Hash do código do link "ver/cancelar meu horário" (agendamento online). */
  @Column({ name: 'manage_token_hash', type: 'varchar', length: 64, nullable: true, unique: true, select: false })
  manageTokenHash: string | null;

  /** Lembretes já enviados (cada um sai uma vez; o job "reserva" a vez antes de mandar). */
  @Column({ name: 'reminded_24_at', type: 'timestamptz', nullable: true })
  reminded24At: Date | null;

  @Column({ name: 'reminded_2_at', type: 'timestamptz', nullable: true })
  reminded2At: Date | null;

  /** Reserva online com vários procedimentos: todos compartilham o grupo e o mesmo link (hash em `groupTokenHash`). */
  @Index()
  @Column({ name: 'booking_group_id', type: 'uuid', nullable: true })
  bookingGroupId: string | null;

  @Index()
  @Column({ name: 'group_token_hash', type: 'varchar', length: 64, nullable: true, select: false })
  groupTokenHash: string | null;

  /** Chamado no painel de TV da recepção. */
  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt: Date | null;

  @Column({ name: 'created_by_member_id', type: 'uuid', nullable: true })
  createdByMemberId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
