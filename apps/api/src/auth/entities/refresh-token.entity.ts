import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Refresh token opaco. Guardamos só o hash SHA-256; o valor vive no cookie httpOnly.
 * Cada uso gera um token novo (rotação). Reuso de um token já trocado revoga a família inteira.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Identifica o aparelho/sessão; passa de token para token na rotação. */
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  @Generated('uuid')
  sessionId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'session_started_at', type: 'timestamptz', default: () => 'now()' })
  sessionStartedAt: Date;

  @Index({ unique: true })
  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
