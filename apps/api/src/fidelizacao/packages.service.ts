import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Feature,
  packageStatus,
  sessionsLeft,
  type ClientPackageDto,
  type IsoDate,
  type PackagePlanDto as PackagePlanResponse,
} from '@skedulei/contracts';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { assertFeature } from '../tenancy/feature-gate';
import { orgToday } from '../tenancy/org-today';
import { TenantDb } from '../tenancy/tenant-db';
import { PackagePlanDto, UpdatePackagePlanDto } from './dto/retention.dto';
import { ClientPackage } from './entities/client-package.entity';
import { PackagePlan } from './entities/package-plan.entity';

export const toPackageDto = (c: ClientPackage, today: IsoDate): ClientPackageDto => ({
  id: c.id,
  clientId: c.clientId,
  clientName: c.client?.name ?? '',
  planName: c.planName,
  serviceId: c.serviceId,
  serviceName: c.service?.name ?? '',
  sessionsTotal: c.sessionsTotal,
  sessionsUsed: c.sessionsUsed,
  sessionsLeft: sessionsLeft(c),
  priceCents: c.priceCents,
  purchasedAt: c.purchasedAt,
  expiresAt: c.expiresAt,
  status: packageStatus(c, today),
});

@Injectable()
export class PackagesService {
  constructor(private readonly tenant: TenantDb) {}

  private gate(em: EntityManager, org: OrgContext) {
    return assertFeature(em, org.organizationId, Feature.PACOTES);
  }

  async plans(org: OrgContext): Promise<PackagePlanResponse[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const rows = await em.getRepository(PackagePlan).find({ where: { organizationId: org.organizationId }, relations: { service: true }, order: { active: 'DESC', name: 'ASC' } });
      return rows.map(this.planDto);
    });
  }

  async createPlan(org: OrgContext, dto: PackagePlanDto): Promise<PackagePlanResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const service = await em.getRepository(ServiceItem).findOne({ where: { id: dto.serviceId, organizationId: org.organizationId } });
      if (!service) throw new NotFoundException('Serviço não encontrado');
      const row = await em.getRepository(PackagePlan).save(
        em.getRepository(PackagePlan).create({
          organizationId: org.organizationId,
          name: dto.name,
          serviceId: service.id,
          sessions: dto.sessions,
          priceCents: dto.priceCents,
          validityDays: dto.validityDays ?? null,
          active: true,
        }),
      );
      return this.planDto({ ...row, service } as PackagePlan);
    });
  }

  async updatePlan(org: OrgContext, id: string, dto: UpdatePackagePlanDto): Promise<PackagePlanResponse> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const p = await em.getRepository(PackagePlan).findOne({ where: { id, organizationId: org.organizationId }, relations: { service: true } });
      if (!p) throw new NotFoundException('Pacote não encontrado');
      // Quem já comprou guarda uma cópia: mudar o plano só vale para as próximas vendas.
      Object.assign(p, {
        name: dto.name ?? p.name,
        sessions: dto.sessions ?? p.sessions,
        priceCents: dto.priceCents ?? p.priceCents,
        validityDays: dto.validityDays !== undefined ? dto.validityDays : p.validityDays,
        active: dto.active ?? p.active,
      });
      return this.planDto(await em.getRepository(PackagePlan).save(p));
    });
  }

  /** Pacotes dos clientes (todos ou de um cliente); `onlyActive` serve o seletor da comanda. */
  async clientPackages(org: OrgContext, clientId?: string, onlyActive = false): Promise<ClientPackageDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.gate(em, org);
      const today = await orgToday(em, org.organizationId);
      const rows = await em.getRepository(ClientPackage).find({
        where: { organizationId: org.organizationId, ...(clientId ? { clientId } : {}) },
        relations: { client: true, service: true },
        order: { createdAt: 'DESC' },
        take: 200,
      });
      const dtos = rows.map((r) => toPackageDto(r, today));
      return onlyActive ? dtos.filter((d) => d.status === 'ATIVO') : dtos;
    });
  }

  private planDto = (p: PackagePlan): PackagePlanResponse => ({
    id: p.id,
    name: p.name,
    serviceId: p.serviceId,
    serviceName: p.service?.name ?? '',
    sessions: p.sessions,
    priceCents: p.priceCents,
    validityDays: p.validityDays,
    active: p.active,
  });
}

