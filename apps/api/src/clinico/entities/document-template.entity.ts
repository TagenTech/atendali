import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { DocQuestion, DocumentKind } from '@skedulei/contracts';
import { Organization } from '../../organizations/entities/organization.entity';

/** Modelo de ficha de anamnese (perguntas) ou de termo de consentimento (texto) do negócio. */
@Entity('document_templates')
@Index(['organizationId', 'kind'])
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 10 })
  kind: DocumentKind;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions: DocQuestion[];

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
