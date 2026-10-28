import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { RecordKind } from '@skedulei/contracts';
import { Client } from '../../agenda/entities/client.entity';
import { Organization } from '../../organizations/entities/organization.entity';

/** Anotação do prontuário (evolução, prescrição, atestado). O texto é dado de saúde: sempre cifrado. */
@Entity('clinical_records')
@Index(['organizationId', 'clientId', 'createdAt'])
export class ClinicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /** Quem escreveu (membro do negócio). */
  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 12 })
  kind: RecordKind;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ name: 'content_encrypted', type: 'text' })
  contentEncrypted: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
