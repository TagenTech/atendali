import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { ServiceItem } from '../../organizations/entities/service-item.entity';
import { Product } from './product.entity';

/** Ficha técnica: quanto de cada insumo um atendimento do serviço consome. */
@Entity('service_supplies')
@Index(['serviceId', 'productId'], { unique: true })
export class ServiceSupply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => ServiceItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: ServiceItem;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int' })
  quantity: number;
}
