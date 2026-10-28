import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PHONE_MAX_LENGTH } from '@skedulei/contracts';

/**
 * Código de 6 dígitos da área "Minhas reservas": prova que quem consulta é dono do e-mail cadastrado no telefone.
 * Só o HMAC fica no banco; vale por poucos minutos e por poucas tentativas.
 */
@Entity('portal_codes')
@Index(['organizationId', 'phone', 'createdAt'])
export class PortalCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH })
  phone: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
