import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { ProductKind } from '@agendei/contracts';

@Entity('products')
export class Product {
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

  @Column({ type: 'varchar', length: 8 })
  kind: ProductKind;

  @Column({ type: 'varchar', length: 10, default: 'un' })
  unit: string;

  @Column({ name: 'sale_price_cents', type: 'int', nullable: true })
  salePriceCents: number | null;

  /** Custo médio por unidade (centavos). */
  @Column({ name: 'cost_cents', type: 'int', default: 0 })
  costCents: number;

  @Column({ name: 'min_quantity', type: 'int', default: 0 })
  minQuantity: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
