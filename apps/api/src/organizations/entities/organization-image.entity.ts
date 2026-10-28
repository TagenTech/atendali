import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organization.entity';

/** Logo e imagem de fundo da página pública (uma de cada por negócio), já reduzidas pelo navegador. */
@Entity('organization_images')
@Index(['organizationId', 'kind'], { unique: true })
export class OrganizationImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 8 })
  kind: 'logo' | 'cover';

  @Column({ type: 'varchar', length: 16 })
  mime: string;

  @Column({ type: 'bytea', select: false })
  data: Buffer;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
