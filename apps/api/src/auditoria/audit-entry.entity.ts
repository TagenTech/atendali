import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { AuditAction } from '@skedulei/contracts';
import { Organization } from '../organizations/entities/organization.entity';

/** Registro de auditoria: só se acrescenta (nenhuma rota edita ou apaga). */
@Entity('audit_log')
@Index(['organizationId', 'createdAt'])
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** Quem fez (membro do negócio). */
  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 30 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 30 })
  entity: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 300 })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
