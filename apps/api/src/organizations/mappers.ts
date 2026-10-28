import { loyaltyOf, type BrandingDto, paymentMethodsOf, permissionsOf, vocabularyFor, type MemberDto, type OrganizationDto, type ServiceDto, type UnitDto } from '@skedulei/contracts';
import type { Member } from './entities/member.entity';
import type { Organization } from './entities/organization.entity';
import type { ServiceItem } from './entities/service-item.entity';
import type { Unit } from './entities/unit.entity';

/** Endereços relativos à raiz da API; o web acrescenta o prefixo. A versão (data da troca) renova o cache. */
export function brandingOf(o: Organization): BrandingDto {
  const url = (kind: 'logo' | 'cover', at: Date | null) => (at ? `/public/orgs/${o.slug}/brand/${kind}?v=${at.getTime()}` : null);
  return { logoUrl: url('logo', o.logoUpdatedAt), coverUrl: url('cover', o.coverUpdatedAt), brandColor: o.brandColor, tagline: o.tagline };
}

export function toOrganizationDto(o: Organization, me: Pick<Member, 'id' | 'role'>): OrganizationDto {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    segment: o.segment,
    features: o.features,
    vocabulary: vocabularyFor(o.segment),
    phone: o.phone,
    document: o.document,
    timezone: o.timezone,
    paymentMethods: paymentMethodsOf(o.paymentMethods),
    commissionBase: o.commissionBase,
    loyalty: loyaltyOf(o.loyalty),
    remindersEnabled: o.remindersEnabled,
    branding: brandingOf(o),
    createdAt: o.createdAt.toISOString(),
    me: { memberId: me.id, role: me.role, permissions: permissionsOf(me.role) },
  };
}

export function toUnitDto(u: Unit): UnitDto {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    zipCode: u.zipCode,
    street: u.street,
    number: u.number,
    district: u.district,
    city: u.city,
    state: u.state,
    timezone: u.timezone,
    businessHours: u.businessHours,
    active: u.active,
  };
}

export function toMemberDto(m: Member, myMemberId: string): MemberDto {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    role: m.role,
    status: m.status,
    bookable: m.bookable,
    color: m.color,
    workingHours: m.workingHours,
    commissionBps: m.commissionBps,
    isMe: m.id === myMemberId,
    invitedAt: m.invitedAt?.toISOString() ?? null,
    joinedAt: m.joinedAt?.toISOString() ?? null,
  };
}

export function toServiceDto(s: ServiceItem): ServiceDto {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
    onlineBooking: s.onlineBooking,
    commissionBps: s.commissionBps,
    active: s.active,
  };
}
