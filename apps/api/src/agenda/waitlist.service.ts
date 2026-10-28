import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { todayIn, waitlistMatches, zonedParts, type WaitlistEntryDto } from '@skedulei/contracts';
import { Member } from '../organizations/entities/member.entity';
import { ServiceItem } from '../organizations/entities/service-item.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { CreateWaitlistDto } from './dto/agenda.dto';
import type { Appointment } from './entities/appointment.entity';
import { Client } from './entities/client.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

@Injectable()
export class WaitlistService {
  constructor(private readonly tenant: TenantDb) {}

  private get repo() {
    return this.tenant.repo(WaitlistEntry);
  }

  async list(org: OrgContext): Promise<WaitlistEntryDto[]> {
    const rows = await this.repo.find({
      where: { organizationId: org.organizationId, resolvedAt: IsNull() },
      relations: { client: true, service: true, member: true },
      order: { createdAt: 'ASC' },
    });
    const slotMemberIds = [...new Set(rows.map((r) => r.openSlotMemberId).filter((id): id is string => !!id))];
    const names = new Map(
      (slotMemberIds.length
        ? await this.tenant.repo(Member).find({ where: { id: In(slotMemberIds), organizationId: org.organizationId }, select: { id: true, name: true } })
        : []
      ).map((m) => [m.id, m.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.name,
      clientPhone: r.client.phone,
      serviceId: r.serviceId,
      serviceName: r.service?.name ?? null,
      memberId: r.memberId,
      memberName: r.member?.name ?? null,
      preferredDate: r.preferredDate,
      notes: r.notes,
      openSlot:
        r.openSlotStartsAt && r.openSlotMemberId
          ? { startsAt: r.openSlotStartsAt.toISOString(), memberId: r.openSlotMemberId, memberName: names.get(r.openSlotMemberId) ?? '' }
          : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(org: OrgContext, dto: CreateWaitlistDto): Promise<WaitlistEntryDto> {
    if (!dto.clientId && !dto.newClient) throw new BadRequestException('Escolha o cliente');
    const id = await this.tenant.transaction(async (em) => {
      let clientId = dto.clientId;
      if (clientId) {
        if (!(await em.getRepository(Client).exists({ where: { id: clientId, organizationId: org.organizationId } }))) {
          throw new NotFoundException('Cliente não encontrado');
        }
      } else {
        const c = await em
          .getRepository(Client)
          .save(em.getRepository(Client).create({ organizationId: org.organizationId, name: dto.newClient!.name, phone: dto.newClient!.phone ?? null }));
        clientId = c.id;
      }
      if (dto.serviceId && !(await em.getRepository(ServiceItem).exists({ where: { id: dto.serviceId, organizationId: org.organizationId } }))) {
        throw new NotFoundException('Serviço não encontrado');
      }
      if (dto.memberId && !(await em.getRepository(Member).exists({ where: { id: dto.memberId, organizationId: org.organizationId } }))) {
        throw new NotFoundException('Profissional não encontrado');
      }
      const row = await em.getRepository(WaitlistEntry).save(
        em.getRepository(WaitlistEntry).create({
          organizationId: org.organizationId,
          clientId,
          serviceId: dto.serviceId ?? null,
          memberId: dto.memberId ?? null,
          preferredDate: dto.preferredDate ?? null,
          notes: dto.notes ?? null,
        }),
      );
      return row.id;
    });
    return (await this.list(org)).find((e) => e.id === id)!;
  }

  /** Resolvido (agendou ou desistiu): sai da lista. */
  async resolve(org: OrgContext, id: string): Promise<void> {
    const res = await this.repo.update({ id, organizationId: org.organizationId, resolvedAt: IsNull() }, { resolvedAt: new Date() });
    if (!res.affected) throw new NotFoundException('Pedido não encontrado');
  }

  /**
   * Um horário vagou (cancelamento): marca a vaga nos pedidos em aberto que combinam,
   * para a recepção avisar o cliente. Roda na mesma transação do cancelamento.
   */
  async onSlotFreed(em: EntityManager, a: Pick<Appointment, 'organizationId' | 'serviceId' | 'memberId' | 'startsAt'>, timezone: string) {
    if (a.startsAt.getTime() < Date.now()) return;
    const date = zonedParts(a.startsAt, timezone).date;
    const open = await em.getRepository(WaitlistEntry).find({ where: { organizationId: a.organizationId, resolvedAt: IsNull() } });
    const matching = open.filter(
      (e) => (!e.preferredDate || e.preferredDate >= todayIn(timezone)) && waitlistMatches(e, { serviceId: a.serviceId, memberId: a.memberId, date }),
    );
    if (matching.length) {
      await em
        .getRepository(WaitlistEntry)
        .update({ id: In(matching.map((e) => e.id)), organizationId: a.organizationId }, { openSlotStartsAt: a.startsAt, openSlotMemberId: a.memberId });
    }
  }
}
