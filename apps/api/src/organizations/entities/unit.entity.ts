import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DEFAULT_TIMEZONE, PHONE_MAX_LENGTH, type BusinessHours } from '@skedulei/contracts';
import { Organization } from './organization.entity';

/** Unidade (filial): endereço, fuso e horário de funcionamento próprios. */
@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  @Column({ name: 'zip_code', type: 'varchar', length: 8, nullable: true })
  zipCode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ default: DEFAULT_TIMEZONE, length: 64 })
  timezone: string;

  @Column({ name: 'business_hours', type: 'jsonb' })
  businessHours: BusinessHours;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
