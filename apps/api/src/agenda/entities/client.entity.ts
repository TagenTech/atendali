import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PHONE_MAX_LENGTH } from '@agendei/contracts';
import { Organization } from '../../organizations/entities/organization.entity';

/** Cliente/paciente de um negócio. Observações podem ter dado de saúde: ficam cifradas. */
@Entity('clients')
@Index(['organizationId', 'phone'])
export class Client {
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

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  /** AES-256-GCM (`encryptField`): pode conter alergias, condições de saúde etc. */
  @Column({ name: 'notes_encrypted', type: 'text', nullable: true })
  notesEncrypted: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  /** Exclusão a pedido (LGPD): dados apagados, histórico de atendimentos mantido sem identificação. */
  @Column({ name: 'anonymized_at', type: 'timestamptz', nullable: true })
  anonymizedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
