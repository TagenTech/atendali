import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Client } from '../../agenda/entities/client.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';

/** Pacote comprado por um cliente (o plano é copiado: mudar o plano não muda o que ele comprou). */
@Entity('client_packages')
@Index(['organizationId', 'clientId'])
export class ClientPackage {
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

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'plan_name', length: 120 })
  planName: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => ServiceItem, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem;

  @Column({ name: 'sessions_total', type: 'smallint' })
  sessionsTotal: number;

  @Column({ name: 'sessions_used', type: 'smallint', default: 0 })
  sessionsUsed: number;

  /** O que o cliente pagou por este pacote. */
  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'purchased_at', type: 'date' })
  purchasedAt: string;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: string | null;

  /** Item da comanda em que foi vendido (para estornar). */
  @Index()
  @Column({ name: 'sold_order_item_id', type: 'uuid', nullable: true })
  soldOrderItemId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Uso de sessões numa comanda. */
@Entity('package_uses')
export class PackageUse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_package_id', type: 'uuid' })
  clientPackageId: string;

  @ManyToOne(() => ClientPackage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_package_id' })
  clientPackage: ClientPackage;

  @Index({ unique: true })
  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @Column({ type: 'smallint' })
  quantity: number;

  @CreateDateColumn({ name: 'used_at', type: 'timestamptz' })
  usedAt: Date;
}
