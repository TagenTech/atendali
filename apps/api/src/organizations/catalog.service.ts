import { Injectable, NotFoundException } from '@nestjs/common';
import type { ServiceDto as ServiceResponse, UnitDto as UnitResponse } from '@skedulei/contracts';
import { ServiceDto, UnitDto, UpdateServiceDto, UpdateUnitDto } from './dto/organization.dto';
import { ServiceItem } from './entities/service-item.entity';
import { Unit } from './entities/unit.entity';
import { toServiceDto, toUnitDto } from './mappers';
import type { OrgContext } from './org-context';
import { TenantDb } from '../tenancy/tenant-db';

/** Catálogo do negócio: unidades e serviços. */
@Injectable()
export class CatalogService {
  constructor(private readonly tenant: TenantDb) {}

  private get units() {
    return this.tenant.repo(Unit);
  }

  private get services() {
    return this.tenant.repo(ServiceItem);
  }

  async listUnits(org: OrgContext): Promise<UnitResponse[]> {
    const rows = await this.units.find({ where: { organizationId: org.organizationId }, order: { createdAt: 'ASC' } });
    return rows.map(toUnitDto);
  }

  async createUnit(org: OrgContext, dto: UnitDto): Promise<UnitResponse> {
    const row = this.units.create({ ...dto, organizationId: org.organizationId });
    return toUnitDto(await this.units.save(row));
  }

  async updateUnit(org: OrgContext, id: string, dto: UpdateUnitDto): Promise<UnitResponse> {
    const row = await this.units.findOne({ where: { id, organizationId: org.organizationId } });
    if (!row) throw new NotFoundException('Unidade não encontrada');
    return toUnitDto(await this.units.save(Object.assign(row, dto)));
  }

  async listServices(org: OrgContext): Promise<ServiceResponse[]> {
    const rows = await this.services.find({
      where: { organizationId: org.organizationId },
      order: { active: 'DESC', category: 'ASC', name: 'ASC' },
    });
    return rows.map(toServiceDto);
  }

  async createService(org: OrgContext, dto: ServiceDto): Promise<ServiceResponse> {
    const row = this.services.create({ ...dto, organizationId: org.organizationId });
    return toServiceDto(await this.services.save(row));
  }

  async updateService(org: OrgContext, id: string, dto: UpdateServiceDto): Promise<ServiceResponse> {
    const row = await this.services.findOne({ where: { id, organizationId: org.organizationId } });
    if (!row) throw new NotFoundException('Serviço não encontrado');
    return toServiceDto(await this.services.save(Object.assign(row, dto)));
  }
}
