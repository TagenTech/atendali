import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';

/** Pacote à venda: N sessões de um serviço por um preço fechado. */
@Entity('package_plans')
export class PackagePlan {
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

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => ServiceItem, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem;

  @Column({ type: 'smallint' })
  sessions: number;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'validity_days', type: 'int', nullable: true })
  validityDays: number | null;

  @Column({ default: true })
  active: boolean;
}
