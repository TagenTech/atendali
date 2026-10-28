import type { AppointmentDto, BlockDto, ClientDto } from '@skedulei/contracts';
import { decryptField } from '../common/crypto/field-crypto';
import type { Appointment } from './entities/appointment.entity';
import type { ScheduleBlock } from './entities/block.entity';
import type { Client } from './entities/client.entity';

/** Precisa das relações client, member e service carregadas. */
export function toAppointmentDto(a: Appointment, orderId: string | null = null): AppointmentDto {
  return {
    id: a.id,
    unitId: a.unitId,
    clientId: a.clientId,
    clientName: a.client.name,
    clientPhone: a.client.phone,
    memberId: a.memberId,
    memberName: a.member.name,
    serviceId: a.serviceId,
    serviceName: a.service.name,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    priceCents: a.priceCents,
    notes: a.notes,
    source: a.source,
    orderId,
    calledAt: a.calledAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export const APPOINTMENT_RELATIONS = { client: true, member: true, service: true } as const;

export function toClientDto(c: Client): ClientDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    birthDate: c.birthDate,
    notes: c.notesEncrypted ? decryptField(c.notesEncrypted) : null,
    tags: c.tags,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toBlockDto(b: ScheduleBlock): BlockDto {
  return {
    id: b.id,
    memberId: b.memberId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    reason: b.reason,
  };
}
