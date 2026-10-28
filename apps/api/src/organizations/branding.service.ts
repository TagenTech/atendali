import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BRAND_IMAGE_MAX_BYTES, sniffImageMime, type BrandImageKind, type OrganizationDto } from '@agendei/contracts';
import { TenantDb } from '../tenancy/tenant-db';
import { Organization } from './entities/organization.entity';
import { OrganizationImage } from './entities/organization-image.entity';
import { toOrganizationDto } from './mappers';
import type { OrgContext } from './org-context';

const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const COLUMN = { logo: 'logoUpdatedAt', cover: 'coverUpdatedAt' } as const;

@Injectable()
export class BrandingService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly db: DataSource,
  ) {}

  /** Troca a imagem. O tipo vem dos bytes (não do que o navegador declarou) e SVG nunca entra. */
  async setImage(org: OrgContext, kind: BrandImageKind, dataUrl: string): Promise<OrganizationDto> {
    const m = DATA_URL.exec(dataUrl);
    if (!m) throw new BadRequestException('Envie uma imagem PNG, JPG ou WebP');
    const data = Buffer.from(m[1], 'base64');
    const mime = sniffImageMime(data);
    if (!mime) throw new BadRequestException('Envie uma imagem PNG, JPG ou WebP');
    if (data.length > BRAND_IMAGE_MAX_BYTES[kind]) {
      throw new BadRequestException(`Imagem grande demais (máximo ${Math.round(BRAND_IMAGE_MAX_BYTES[kind] / 1000)} KB depois de reduzida)`);
    }
    return this.tenant.transaction(async (em) => {
      const images = em.getRepository(OrganizationImage);
      await images.upsert({ organizationId: org.organizationId, kind, mime, data }, ['organizationId', 'kind']);
      const o = await em.getRepository(Organization).findOneByOrFail({ id: org.organizationId });
      o[COLUMN[kind]] = new Date();
      return toOrganizationDto(await em.getRepository(Organization).save(o), { id: org.memberId, role: org.role });
    });
  }

  async removeImage(org: OrgContext, kind: BrandImageKind): Promise<OrganizationDto> {
    return this.tenant.transaction(async (em) => {
      await em.getRepository(OrganizationImage).delete({ organizationId: org.organizationId, kind });
      const o = await em.getRepository(Organization).findOneByOrFail({ id: org.organizationId });
      o[COLUMN[kind]] = null;
      return toOrganizationDto(await em.getRepository(Organization).save(o), { id: org.memberId, role: org.role });
    });
  }

  /** Página pública: devolve os bytes pelo endereço do negócio (sem login). */
  async publicImage(slug: string, kind: BrandImageKind): Promise<{ mime: string; data: Buffer }> {
    const org = await this.db.getRepository(Organization).findOne({ where: { slug }, select: { id: true } });
    if (!org) throw new NotFoundException('Imagem não encontrada');
    const img = await this.db
      .getRepository(OrganizationImage)
      .createQueryBuilder('i')
      .addSelect('i.data')
      .where('i.organizationId = :id AND i.kind = :kind', { id: org.id, kind })
      .getOne();
    if (!img) throw new NotFoundException('Imagem não encontrada');
    return { mime: img.mime, data: img.data };
  }
}
