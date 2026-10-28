import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DEFAULT_TIMEZONE, type BrandColor, PHONE_MAX_LENGTH, type CommissionBase, type Feature, type LoyaltyRule, type PaymentMethodConfig, type Segment } from '@agendei/contracts';

/** Negócio (conta SaaS). Todo dado de negócio tem `organizationId` e é filtrado por ele. */
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  /** Endereço público da página de agendamento. */
  @Column({ length: 48, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 24 })
  segment: Segment;

  /** Módulos ligados (ver `FEATURES` em contracts). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  features: Feature[];

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  /** CNPJ ou CPF, só dígitos. */
  @Column({ type: 'varchar', length: 14, nullable: true })
  document: string | null;

  @Column({ default: DEFAULT_TIMEZONE, length: 64 })
  timezone: string;

  /** Formas de pagamento (null = padrão). */
  @Column({ name: 'payment_methods', type: 'jsonb', nullable: true })
  paymentMethods: PaymentMethodConfig[] | null;

  /** Regras de fidelidade (null = padrão, desligado). */
  @Column({ type: 'jsonb', nullable: true })
  loyalty: LoyaltyRule | null;

  /** Cor de destaque da página pública (chave de BRAND_COLORS). */
  @Column({ name: 'brand_color', type: 'varchar', length: 12, nullable: true })
  brandColor: BrandColor | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  tagline: string | null;

  /** Quando a logo / o fundo foram trocados (null = sem imagem); serve de versão do endereço. */
  @Column({ name: 'logo_updated_at', type: 'timestamptz', nullable: true })
  logoUpdatedAt: Date | null;

  @Column({ name: 'cover_updated_at', type: 'timestamptz', nullable: true })
  coverUpdatedAt: Date | null;

  @Column({ name: 'commission_base', type: 'varchar', length: 8, default: 'BRUTO' })
  commissionBase: CommissionBase;

  /** Último número de comanda usado. */
  @Column({ name: 'order_seq', type: 'int', default: 0 })
  orderSeq: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
