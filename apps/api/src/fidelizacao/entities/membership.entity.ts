import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { MembershipStatus } from '@skedulei/contracts';
import { Client } from '../../agenda/entities/client.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';

@Entity('membership_plans')
export class MembershipPlan {
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

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  /** null = vale para qualquer serviço. */
  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => ServiceItem, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem | null;

  /** null = ilimitado. */
  @Column({ name: 'sessions_per_month', type: 'smallint', nullable: true })
  sessionsPerMonth: number | null;

  @Column({ default: true })
  active: boolean;
}

/** Assinatura de um cliente. Os ciclos mensais contam a partir de `anchor`. */
@Entity('client_memberships')
@Index(['organizationId', 'clientId'])
export class ClientMembership {
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

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'plan_name', length: 120 })
  planName: string;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => ServiceItem, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem | null;

  @Column({ name: 'sessions_per_month', type: 'smallint', nullable: true })
  sessionsPerMonth: number | null;

  @Column({ type: 'varchar', length: 10 })
  status: MembershipStatus;

  @Column({ type: 'date', nullable: true })
  anchor: string | null;

  @Column({ name: 'cycles_paid', type: 'int', default: 0 })
  cyclesPaid: number;

  @Column({ name: 'paid_through', type: 'date', nullable: true })
  paidThrough: string | null;

  /** Item da comanda que criou a assinatura / que pagou a última mensalidade (para estornar). */
  @Column({ name: 'created_order_item_id', type: 'uuid', nullable: true })
  createdOrderItemId: string | null;

  @Column({ name: 'last_order_item_id', type: 'uuid', nullable: true })
  lastOrderItemId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('membership_uses')
export class MembershipUse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'membership_id', type: 'uuid' })
  membershipId: string;

  @ManyToOne(() => ClientMembership, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membership_id' })
  membership: ClientMembership;

  @Index({ unique: true })
  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @Column({ type: 'smallint' })
  quantity: number;

  @Column({ name: 'used_date', type: 'date' })
  usedDate: string;
}
