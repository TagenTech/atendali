import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import type { OrderItemKind } from '@skedulei/contracts';
import { Member } from '../../organizations/entities/member.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 20 })
  kind: OrderItemKind;

  /** Produto, plano, pacote/assinatura do cliente — conforme o tipo (ver OrderItemKind). */
  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  /** Valor de referência por unidade para a comissão de itens de valor zero (sessão de pacote/clube). */
  @Column({ name: 'ref_value_cents', type: 'int', nullable: true })
  refValueCents: number | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  /** Agendamento de onde veio (check-in). Fechar a comanda conclui o agendamento. */
  @Index()
  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /** Quem fez (recebe a comissão). */
  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId: string | null;

  @ManyToOne(() => Member, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'member_id' })
  member: Member | null;

  @Column({ length: 160 })
  description: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price_cents', type: 'int' })
  unitPriceCents: number;

  @Column({ name: 'discount_cents', type: 'int', default: 0 })
  discountCents: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
