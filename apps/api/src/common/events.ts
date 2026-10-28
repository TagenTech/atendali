/** Eventos internos entre módulos (via @nestjs/event-emitter), evitando dependências circulares. */

export const Events = {
  MEMBER_JOINED: 'member.joined',
} as const;

export interface MemberJoinedEvent {
  organizationId: string;
  memberId: string;
  userId: string;
}
