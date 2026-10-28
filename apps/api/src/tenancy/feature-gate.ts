import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Feature } from '@skedulei/contracts';
import { Organization } from '../organizations/entities/organization.entity';

/** Recusa a ação quando o módulo está desligado no negócio (Negócio → Módulos). */
export async function assertFeature(em: EntityManager, organizationId: string, feature: Feature): Promise<void> {
  const org = await em.getRepository(Organization).findOne({ where: { id: organizationId }, select: { id: true, features: true } });
  if (!org?.features.includes(feature)) throw new ForbiddenException('Este módulo está desligado. Ligue em Negócio → Módulos.');
}
