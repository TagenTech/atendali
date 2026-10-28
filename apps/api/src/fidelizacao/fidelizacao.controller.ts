import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission as P } from '@agendei/contracts';
import { Public } from '../common/decorators/public.decorator';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import {
  AdjustPointsDto,
  ClientFilterDto,
  GiftLookupDto,
  MembershipPlanDto,
  MembershipStatusDto,
  PackagePlanDto,
  ReviewVisibilityDto,
  SubmitReviewDto,
  UpdateMembershipPlanDto,
  UpdatePackagePlanDto,
} from './dto/retention.dto';
import { GiftCardsService } from './gift-cards.service';
import { LoyaltyService } from './loyalty.service';
import { MembershipsService } from './memberships.service';
import { PackagesService } from './packages.service';
import { ReviewsService } from './reviews.service';

@ApiTags('pacotes')
@ApiBearerAuth()
@Controller('org')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('package-plans')
  @OrgRoute(P.SERVICES_VIEW)
  plans(@CurrentOrg() org: OrgContext) {
    return this.packages.plans(org);
  }

  @Post('package-plans')
  @OrgRoute(P.SERVICES_MANAGE)
  createPlan(@CurrentOrg() org: OrgContext, @Body() dto: PackagePlanDto) {
    return this.packages.createPlan(org, dto);
  }

  @Patch('package-plans/:id')
  @OrgRoute(P.SERVICES_MANAGE)
  updatePlan(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePackagePlanDto) {
    return this.packages.updatePlan(org, id, dto);
  }

  @Get('client-packages')
  @OrgRoute(P.CLIENTS_VIEW)
  clientPackages(@CurrentOrg() org: OrgContext, @Query() q: ClientFilterDto, @Query('ativos') active?: string) {
    return this.packages.clientPackages(org, q.clientId, active === '1');
  }
}

@ApiTags('clube')
@ApiBearerAuth()
@Controller('org')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('membership-plans')
  @OrgRoute(P.SERVICES_VIEW)
  plans(@CurrentOrg() org: OrgContext) {
    return this.memberships.plans(org);
  }

  @Post('membership-plans')
  @OrgRoute(P.SERVICES_MANAGE)
  createPlan(@CurrentOrg() org: OrgContext, @Body() dto: MembershipPlanDto) {
    return this.memberships.createPlan(org, dto);
  }

  @Patch('membership-plans/:id')
  @OrgRoute(P.SERVICES_MANAGE)
  updatePlan(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipPlanDto) {
    return this.memberships.updatePlan(org, id, dto);
  }

  @Get('memberships')
  @OrgRoute(P.CLIENTS_VIEW)
  list(@CurrentOrg() org: OrgContext, @Query() q: ClientFilterDto) {
    return this.memberships.list(org, q.clientId);
  }

  @Patch('memberships/:id')
  @OrgRoute(P.CLIENTS_MANAGE)
  setStatus(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MembershipStatusDto) {
    return this.memberships.setStatus(org, id, dto.status);
  }
}

@ApiTags('vales')
@ApiBearerAuth()
@Controller('org/gift-cards')
export class GiftCardsController {
  constructor(private readonly gifts: GiftCardsService) {}

  @Get()
  @OrgRoute(P.CASH_OPERATE)
  list(@CurrentOrg() org: OrgContext) {
    return this.gifts.list(org);
  }

  /** Consulta o saldo pelo código. Limitado: código é "senha de dinheiro". */
  @Get('lookup')
  @OrgRoute(P.CASH_OPERATE)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  lookup(@CurrentOrg() org: OrgContext, @Query() q: GiftLookupDto) {
    return this.gifts.lookup(org, q.code);
  }
}

@ApiTags('fidelidade')
@ApiBearerAuth()
@Controller('org/loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get(':clientId')
  @OrgRoute(P.CLIENTS_VIEW)
  balance(@CurrentOrg() org: OrgContext, @Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.loyalty.balance(org, clientId);
  }

  @Post(':clientId/adjust')
  @OrgRoute(P.CLIENTS_MANAGE)
  adjust(@CurrentOrg() org: OrgContext, @Param('clientId', ParseUUIDPipe) clientId: string, @Body() dto: AdjustPointsDto) {
    return this.loyalty.adjust(org, clientId, dto);
  }
}

@ApiTags('avaliações')
@ApiBearerAuth()
@Controller('org')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('orders/:id/review-request')
  @OrgRoute(P.CASH_OPERATE)
  @Throttle({ default: { ttl: 3_600_000, limit: 120 } })
  request(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.request(org, id);
  }

  @Get('reviews')
  @OrgRoute(P.CLIENTS_VIEW)
  list(@CurrentOrg() org: OrgContext) {
    return this.reviews.list(org);
  }

  @Patch('reviews/:id')
  @OrgRoute(P.CLIENTS_MANAGE)
  setPublished(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewVisibilityDto) {
    return this.reviews.setPublished(org, id, dto.published);
  }
}

/** Avaliar um atendimento: sem login, só com o link recebido. */
@ApiTags('avaliações públicas')
@Public()
@Controller('public/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  info(@Param('token') token: string) {
    return this.reviews.info(token);
  }

  @Post(':token')
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  submit(@Param('token') token: string, @Body() dto: SubmitReviewDto) {
    return this.reviews.submit(token, dto);
  }
}
