import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PHONE_MAX_LENGTH, type BusinessHours, type MemberStatus, type Role } from '@agendei/contracts';
import { User } from '../../users/entities/user.entity';
import { Organization } from './organization.entity';

/**
 * Pessoa da equipe de um negócio. Pode ter conta (userId) ou não (SEM_ACESSO: só aparece na agenda).
 * Uma conta tem no máximo um cadastro por negócio.
 */
@Entity('members')
@Index(['organizationId', 'userId'], { unique: true, where: '"user_id" IS NOT NULL' })
@Index(['organizationId', 'email'], { unique: true, where: '"email" IS NOT NULL' })
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  /** Excluir a conta mantém o nome no histórico do negócio, sem acesso. */
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ length: 120 })
  name: string;

  /** Minúsculo. Para quem tem acesso ou foi convidado. */
  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 16 })
  role: Role;

  @Column({ type: 'varchar', length: 16 })
  status: MemberStatus;

  /** Atende clientes (coluna própria na agenda). */
  @Column({ default: false })
  bookable: boolean;

  /** Horário próprio de atendimento (null = segue a unidade). O efetivo é a interseção com a unidade. */
  @Column({ name: 'working_hours', type: 'jsonb', nullable: true })
  workingHours: BusinessHours | null;

  /** Comissão padrão em bps (null = 0). */
  @Column({ name: 'commission_bps', type: 'int', nullable: true })
  commissionBps: number | null;

  /** Índice da cor na agenda (1…MEMBER_COLOR_COUNT). */
  @Column({ type: 'smallint', default: 1 })
  color: number;

  @Column({ name: 'invite_token_hash', type: 'varchar', length: 64, nullable: true, unique: true, select: false })
  inviteTokenHash: string | null;

  @Column({ name: 'invite_expires_at', type: 'timestamptz', nullable: true })
  inviteExpiresAt: Date | null;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joinedAt: Date | null;

  /** Removida da equipe mas com atendimentos no histórico: some da equipe, o nome fica na agenda antiga. */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
