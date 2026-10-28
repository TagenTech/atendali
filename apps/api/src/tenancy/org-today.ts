import { DEFAULT_TIMEZONE, todayIn, type IsoDate } from '@agendei/contracts';
import type { EntityManager } from 'typeorm';
import { Unit } from '../organizations/entities/unit.entity';

/** "Hoje" no fuso da unidade principal do negócio. */
export async function orgToday(em: EntityManager, organizationId: string): Promise<IsoDate> {
  const unit = await em.getRepository(Unit).findOne({ where: { organizationId, active: true }, order: { createdAt: 'ASC' }, select: { id: true, timezone: true } });
  return todayIn(unit?.timezone ?? DEFAULT_TIMEZONE);
}
