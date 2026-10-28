import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  canAssignRole,
  isValidSlug,
  MemberStatus,
  normalizeFeatures,
  loyaltyOf,
  paymentMethodsOf,
  validateLoyalty,
  Role,
  SEGMENT_PRESETS,
  SecurityEventType as Ev,
  slugify,
  type OrganizationDto,
  type OrganizationSummaryDto,
} from '@skedulei/contracts';
import type { RequestContext } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { User } from '../users/entities/user.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { Member } from './entities/member.entity';
import { Organization } from './entities/organization.entity';
import { ServiceItem } from './entities/service-item.entity';
import { Unit } from './entities/unit.entity';
import { toOrganizationDto } from './mappers';
import { MembersService, type PendingInvite } from './members.service';
import type { OrgContext } from './org-context';
import { TenantDb } from '../tenancy/tenant-db';

/** Limite de negócios criados por conta (evita abuso; redes maiores falam com o suporte). */
export const MAX_ORGS_PER_USER = 10;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly membersService: MembersService,
    private readonly events: SecurityEventsService,
    private readonly db: DataSource,
  ) {}

  private get repo() {
    return this.tenant.repo(Organization);
  }

  private get members() {
    return this.tenant.repo(Member);
  }

  /** Negócios em que a conta está ativa (para o seletor e para decidir se vai ao onboarding). */
  async listMine(userId: string): Promise<OrganizationSummaryDto[]> {
    const rows = await this.members.find({
      where: { userId, status: MemberStatus.ATIVO },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      segment: m.organization.segment,
      role: m.role,
    }));
  }

  async get(org: OrgContext): Promise<OrganizationDto> {
    const o = await this.repo.findOneByOrFail({ id: org.organizationId });
    return toOrganizationDto(o, { id: org.memberId, role: org.role });
  }

  /** Onboarding: negócio + 1ª unidade + dono na equipe + serviços + convites, tudo ou nada. */
  async create(userId: string, dto: CreateOrganizationDto, ctx: RequestContext = {}): Promise<OrganizationDto> {
    const owned = await this.members.count({ where: { userId, role: Role.DONO } });
    if (owned >= MAX_ORGS_PER_USER) throw new BadRequestException('Limite de negócios atingido. Fale com o suporte.');
    for (const t of dto.team ?? []) {
      if (!canAssignRole(Role.DONO, t.role)) throw new BadRequestException('Perfil de acesso inválido');
    }

    const user = await this.db.getRepository(User).findOneByOrFail({ id: userId });
    const timezone = dto.unit.timezone ?? user.timezone;
    const features = normalizeFeatures(dto.features ?? SEGMENT_PRESETS[dto.segment].features);

    const { org, owner, invites } = await this.db.transaction(async (em) => {
      const org = await em.getRepository(Organization).save(
        em.getRepository(Organization).create({
          name: dto.name,
          slug: await this.uniqueSlug(em, dto.name),
          segment: dto.segment,
          features,
          phone: dto.phone ?? dto.unit.phone ?? null,
          timezone,
          createdBy: userId,
        }),
      );
      await em.getRepository(Unit).save(
        em.getRepository(Unit).create({
          organizationId: org.id,
          name: dto.unit.name,
          phone: dto.unit.phone ?? dto.phone ?? null,
          zipCode: dto.unit.zipCode ?? null,
          street: dto.unit.street ?? null,
          number: dto.unit.number ?? null,
          district: dto.unit.district ?? null,
          city: dto.unit.city ?? null,
          state: dto.unit.state ?? null,
          timezone,
          businessHours: dto.unit.businessHours,
        }),
      );
      const owner = await em.getRepository(Member).save(
        em.getRepository(Member).create({
          organizationId: org.id,
          userId,
          name: user.name,
          email: user.email.toLowerCase(),
          phone: user.phone,
          role: Role.DONO,
          status: MemberStatus.ATIVO,
          bookable: dto.ownerBookable,
          color: 1,
          joinedAt: new Date(),
        }),
      );
      if (dto.services.length) {
        await em.getRepository(ServiceItem).insert(
          dto.services.map((s) => ({
            organizationId: org.id,
            name: s.name,
            category: s.category ?? null,
            description: s.description ?? null,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
            onlineBooking: s.onlineBooking ?? true,
          })),
        );
      }
      const invites: PendingInvite[] = [];
      for (const t of dto.team ?? []) {
        if (t.email && t.email === owner.email) continue;
        const added = await this.membersService.add(em, org.id, t);
        if (added.token) invites.push(added as PendingInvite);
      }
      return { org, owner, invites };
    });

    await this.events.record(Ev.ORG_CREATED, userId, ctx, { org: org.id, segment: org.segment });
    const orgCtx: OrgContext = { organizationId: org.id, memberId: owner.id, role: Role.DONO };
    for (const invite of invites) await this.membersService.sendInvite(invite, orgCtx, ctx);
    return toOrganizationDto(org, owner);
  }

  async update(org: OrgContext, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    const o = await this.repo.findOneByOrFail({ id: org.organizationId });
    if (dto.name !== undefined) o.name = dto.name;
    if (dto.phone !== undefined) o.phone = dto.phone;
    if (dto.document !== undefined) o.document = dto.document;
    if (dto.features !== undefined) o.features = normalizeFeatures(dto.features);
    if (dto.paymentMethods !== undefined) o.paymentMethods = paymentMethodsOf(dto.paymentMethods);
    if (dto.brandColor !== undefined) o.brandColor = dto.brandColor;
    if (dto.tagline !== undefined) o.tagline = dto.tagline;
    if (dto.commissionBase !== undefined) o.commissionBase = dto.commissionBase;
    if (dto.remindersEnabled !== undefined) o.remindersEnabled = dto.remindersEnabled;
    if (dto.loyalty !== undefined) {
      const rule = loyaltyOf(dto.loyalty);
      const problem = validateLoyalty(rule);
      if (problem) throw new BadRequestException(problem);
      o.loyalty = rule;
    }
    return toOrganizationDto(await this.repo.save(o), { id: org.memberId, role: org.role });
  }

  /** "Studio Bella" → studio-bella, studio-bella-2, … */
  private async uniqueSlug(em: EntityManager, name: string): Promise<string> {
    let base = slugify(name);
    if (!isValidSlug(base)) base = slugify(`${base || 'negocio'}-agenda`);
    const taken = new Set<string>(
      (
        await em
          .getRepository(Organization)
          .createQueryBuilder('o')
          .select('o.slug', 'slug')
          .where('o.slug = :base OR o.slug LIKE :prefix', { base, prefix: `${base.slice(0, 44)}-%` })
          .getRawMany<{ slug: string }>()
      ).map((r) => r.slug),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base.slice(0, 44)}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
}
