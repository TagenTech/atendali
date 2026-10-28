import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  abcClasses,
  averageCost,
  Feature,
  movementDelta,
  ProductKind,
  stockStatus,
  type ProductDto as ProductResponse,
  type ServiceSupplyDto,
  type StockMovementDto,
  type StockMovementKind,
  type StockReportDto,
} from '@agendei/contracts';
import { Order } from '../financeiro/entities/order.entity';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { assertFeature } from '../tenancy/feature-gate';
import { TenantDb } from '../tenancy/tenant-db';
import { MovementDto, ProductDto, SuppliesDto, UpdateProductDto } from './dto/stock.dto';
import { Product } from './entities/product.entity';
import { ServiceSupply } from './entities/service-supply.entity';
import { StockMovement } from './entities/stock-movement.entity';

export const toProductDto = (p: Product): ProductResponse => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  unit: p.unit,
  salePriceCents: p.salePriceCents,
  costCents: p.costCents,
  minQuantity: p.minQuantity,
  quantity: p.quantity,
  status: stockStatus(p.quantity, p.minQuantity),
  valueCents: Math.max(0, p.quantity) * p.costCents,
  active: p.active,
});

/** Baixa e entrada de estoque (usada pelos lançamentos manuais e pela comanda). */
export interface ApplyMovement {
  organizationId: string;
  productId: string;
  kind: StockMovementKind;
  /** Quantidade digitada (positiva). */
  quantity: number;
  unitCostCents?: number;
  note?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  memberId?: string | null;
}

@Injectable()
export class StockService {
  constructor(private readonly tenant: TenantDb) {}

  private gate(em: EntityManager, org: OrgContext) {
    return assertFeature(em, org.organizationId, Feature.ESTOQUE);
  }

  async list(org: OrgContext): Promise<ProductResponse[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const rows = await em.getRepository(Product).find({ where: { organizationId: org.organizationId }, order: { active: 'DESC', name: 'ASC' } });
      return rows.map(toProductDto);
    });
  }

  async create(org: OrgContext, dto: ProductDto): Promise<ProductResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      if (dto.kind === ProductKind.VENDA && dto.salePriceCents == null) throw new BadRequestException('Produto de venda precisa de preço de venda');
      const p = await em.getRepository(Product).save(
        em.getRepository(Product).create({
          organizationId: org.organizationId,
          name: dto.name,
          kind: dto.kind,
          unit: dto.unit ?? 'un',
          salePriceCents: dto.kind === ProductKind.VENDA ? (dto.salePriceCents ?? null) : null,
          costCents: dto.costCents ?? 0,
          minQuantity: dto.minQuantity ?? 0,
          quantity: 0,
          active: true,
        }),
      );
      return toProductDto(p);
    });
  }

  async update(org: OrgContext, id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const p = await this.find(em, org.organizationId, id);
      if (dto.name !== undefined) p.name = dto.name;
      if (dto.unit !== undefined) p.unit = dto.unit;
      if (dto.minQuantity !== undefined) p.minQuantity = dto.minQuantity;
      if (dto.costCents !== undefined) p.costCents = dto.costCents;
      if (dto.active !== undefined) p.active = dto.active;
      if (dto.salePriceCents !== undefined) {
        if (p.kind === ProductKind.VENDA && dto.salePriceCents === null) throw new BadRequestException('Produto de venda precisa de preço de venda');
        p.salePriceCents = p.kind === ProductKind.VENDA ? dto.salePriceCents : null;
      }
      return toProductDto(await em.getRepository(Product).save(p));
    });
  }

  async movements(org: OrgContext, productId?: string): Promise<StockMovementDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const rows = await em.getRepository(StockMovement).find({
        where: { organizationId: org.organizationId, ...(productId ? { productId } : {}) },
        relations: { product: true },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      const numbers = await this.orderNumbers(em, org.organizationId, rows.map((r) => r.orderId));
      return rows.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        kind: m.kind,
        quantity: m.quantity,
        unitCostCents: m.unitCostCents,
        balanceAfter: m.balanceAfter,
        note: m.note,
        orderNumber: m.orderId ? (numbers.get(m.orderId) ?? null) : null,
        createdAt: m.createdAt.toISOString(),
      }));
    });
  }

  /** Lançamento manual: entrada (atualiza o custo médio), saída (não passa do saldo) ou inventário. */
  async move(org: OrgContext, dto: MovementDto): Promise<ProductResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      if (dto.kind !== 'AJUSTE' && dto.quantity < 1) throw new BadRequestException('Informe a quantidade');
      const p = await this.apply(em, {
        organizationId: org.organizationId,
        productId: dto.productId,
        kind: dto.kind,
        quantity: dto.quantity,
        unitCostCents: dto.unitCostCents,
        note: dto.note ?? null,
        memberId: org.memberId,
      });
      return toProductDto(p);
    });
  }

  /**
   * Aplica um movimento travando a linha do produto (duas comandas fechando juntas não perdem baixa).
   * Baixas da comanda podem deixar o saldo negativo (a venda já aconteceu); a saída manual não.
   */
  async apply(em: EntityManager, m: ApplyMovement): Promise<Product> {
    const repo = em.getRepository(Product);
    const p = await repo
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.id = :id AND p.organizationId = :org', { id: m.productId, org: m.organizationId })
      .getOne();
    if (!p) throw new NotFoundException('Produto não encontrado');
    if (m.kind === 'SAIDA' && m.quantity > p.quantity) throw new BadRequestException(`Saída maior que o estoque (${p.quantity} ${p.unit})`);
    const delta = movementDelta(m.kind, m.quantity, p.quantity);
    let unitCost = p.costCents;
    if (m.kind === 'ENTRADA' && m.unitCostCents !== undefined) {
      p.costCents = averageCost(p.quantity, p.costCents, m.quantity, m.unitCostCents);
      unitCost = m.unitCostCents;
    }
    p.quantity += delta;
    await repo.save(p);
    await em.getRepository(StockMovement).insert({
      organizationId: m.organizationId,
      productId: p.id,
      kind: m.kind,
      quantity: delta,
      unitCostCents: unitCost,
      balanceAfter: p.quantity,
      note: m.note ?? null,
      orderId: m.orderId ?? null,
      orderItemId: m.orderItemId ?? null,
      memberId: m.memberId ?? null,
    });
    return p;
  }

  // ---------------------------------------------------------------- ficha técnica

  async supplies(org: OrgContext, serviceId: string): Promise<ServiceSupplyDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      return this.suppliesOf(em, org.organizationId, serviceId);
    });
  }

  async setSupplies(org: OrgContext, serviceId: string, dto: SuppliesDto): Promise<ServiceSupplyDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      if (!(await em.getRepository(ServiceItem).exists({ where: { id: serviceId, organizationId: org.organizationId } }))) {
        throw new NotFoundException('Serviço não encontrado');
      }
      const ids = dto.supplies.map((s) => s.productId);
      if (new Set(ids).size !== ids.length) throw new BadRequestException('Insumo repetido na ficha técnica');
      const products = ids.length ? await em.getRepository(Product).find({ where: { id: In(ids), organizationId: org.organizationId } }) : [];
      if (products.length !== ids.length) throw new NotFoundException('Insumo não encontrado');
      if (products.some((p) => p.kind !== ProductKind.INSUMO)) throw new BadRequestException('Só insumos entram na ficha técnica');
      await em.getRepository(ServiceSupply).delete({ serviceId, organizationId: org.organizationId });
      if (dto.supplies.length) {
        await em.getRepository(ServiceSupply).insert(dto.supplies.map((s) => ({ organizationId: org.organizationId, serviceId, productId: s.productId, quantity: s.quantity })));
      }
      return this.suppliesOf(em, org.organizationId, serviceId);
    });
  }

  async suppliesOf(em: EntityManager, organizationId: string, serviceId: string): Promise<ServiceSupplyDto[]> {
    const rows = await em.getRepository(ServiceSupply).find({ where: { serviceId, organizationId }, relations: { product: true }, order: { productId: 'ASC' } });
    return rows.map((r) => ({ productId: r.productId, productName: r.product.name, unit: r.product.unit, quantity: r.quantity }));
  }

  // ---------------------------------------------------------------- relatório

  /** Posição do estoque + curva ABC pelo valor consumido (venda + uso em atendimento) nos últimos 90 dias. */
  async report(org: OrgContext): Promise<StockReportDto> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const products = await em.getRepository(Product).find({ where: { organizationId: org.organizationId, active: true }, order: { name: 'ASC' } });
      const consumed = await em
        .getRepository(StockMovement)
        .createQueryBuilder('m')
        .select('m.productId', 'productId')
        .addSelect('COALESCE(SUM(-m.quantity * m.unitCostCents), 0)', 'cents')
        .where('m.organizationId = :org', { org: org.organizationId })
        .andWhere("m.kind IN ('VENDA', 'CONSUMO', 'ESTORNO') AND m.createdAt >= NOW() - INTERVAL '90 days'")
        .groupBy('m.productId')
        .getRawMany<{ productId: string; cents: string }>();
      const byProduct = new Map(consumed.map((c) => [c.productId, Math.max(0, Number(c.cents))]));
      const abc = abcClasses(products.map((p) => ({ id: p.id, valueCents: byProduct.get(p.id) ?? 0 })));
      const items = products.map((p) => ({ ...toProductDto(p), abc: abc.get(p.id)!, consumedValueCents: byProduct.get(p.id) ?? 0 }));
      return {
        totalValueCents: items.reduce((s, i) => s + i.valueCents, 0),
        belowMinimum: items.filter((i) => i.status === 'BAIXO').length,
        zeroed: items.filter((i) => i.status === 'ZERADO').length,
        items,
      };
    });
  }

  // ---------------------------------------------------------------- utilitários

  private async find(em: EntityManager, organizationId: string, id: string): Promise<Product> {
    const p = await em.getRepository(Product).findOne({ where: { id, organizationId } });
    if (!p) throw new NotFoundException('Produto não encontrado');
    return p;
  }

  private async orderNumbers(em: EntityManager, organizationId: string, ids: (string | null)[]) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map<string, number>();
    const rows = await em.getRepository(Order).find({ where: { id: In(uniq), organizationId }, select: { id: true, number: true } });
    return new Map(rows.map((o) => [o.id, o.number]));
  }
}
