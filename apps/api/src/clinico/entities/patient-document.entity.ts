import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { DocQuestion, DocumentKind, PatientDocumentStatus } from '@skedulei/contracts';
import { Client } from '../../agenda/entities/client.entity';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * Documento enviado a um paciente (pedido + resposta). Guarda uma **cópia** das perguntas/texto no momento do envio:
 * mudar o modelo depois não altera o que o paciente viu nem assinou. Respostas cifradas.
 */
@Entity('patient_documents')
@Index(['organizationId', 'clientId', 'createdAt'])
export class PatientDocument {
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

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar', length: 10 })
  kind: DocumentKind;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions: DocQuestion[];

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Só o hash do código do link; vale até `expiresAt`. */
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'PENDENTE' })
  status: PatientDocumentStatus;

  @Column({ name: 'answers_encrypted', type: 'text', nullable: true })
  answersEncrypted: string | null;

  @Column({ name: 'signed_name', type: 'varchar', length: 120, nullable: true })
  signedName: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_via', type: 'varchar', length: 6, nullable: true })
  completedVia: 'LINK' | 'EQUIPE' | null;

  /** Prova do aceite (quem preencheu pelo link): IP de origem. */
  @Column({ name: 'completed_ip', type: 'varchar', length: 45, nullable: true })
  completedIp: string | null;

  @Column({ name: 'sent_by_member_id', type: 'uuid', nullable: true })
  sentByMemberId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
