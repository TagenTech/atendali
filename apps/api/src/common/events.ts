/** Eventos internos entre módulos (via @nestjs/event-emitter), evitando dependências circulares. */

export const Events = {
  MEMBER_JOINED: 'member.joined',
  BOOKING_CREATED: 'booking.created',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_RESCHEDULED: 'booking.rescheduled',
} as const;

/** Reserva online mexida pelo cliente: avisa a equipe (e-mail). */
export interface BookingChangedEvent {
  appointmentIds: string[];
}

export interface MemberJoinedEvent {
  organizationId: string;
  memberId: string;
  userId: string;
}
