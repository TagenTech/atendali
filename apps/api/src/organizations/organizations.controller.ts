import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { BrandImageKind, Permission as P } from '@skedulei/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { contextOf } from '../security/request-context';
import { BrandingService } from './branding.service';
import { CatalogService } from './catalog.service';
import {
  AcceptInviteDto,
  BrandImageDto,
  CreateOrganizationDto,
  MemberDto,
  ServiceDto,
  UnitDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
  UpdateServiceDto,
  UpdateUnitDto,
} from './dto/organization.dto';
import { MembersService } from './members.service';
import { CurrentOrg, OrgRoute, type OrgContext } from './org-context';
import { OrganizationsService } from './organizations.service';

/** Negócios da conta logada (sem negócio ativo). */
@ApiTags('negócios')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  mine(@CurrentUser() user: JwtPayload) {
    return this.orgs.listMine(user.sub);
  }

  @Post()
  @Throttle({ default: { ttl: 3_600_000, limit: Number(process.env.REGISTER_THROTTLE_LIMIT ?? 10) } })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizationDto, @Req() req: Request) {
    return this.orgs.create(user.sub, dto, contextOf(req));
  }
}

/** Rotas do negócio ativo (header x-organization-id). */
@ApiTags('negócio ativo')
@ApiBearerAuth()
@Controller('org')
export class CurrentOrgController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly members: MembersService,
    private readonly catalog: CatalogService,
    private readonly branding: BrandingService,
  ) {}

  @Get()
  @OrgRoute()
  get(@CurrentOrg() org: OrgContext) {
    return this.orgs.get(org);
  }

  @Patch()
  @OrgRoute(P.ORG_MANAGE)
  update(@CurrentOrg() org: OrgContext, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(org, dto);
  }

  @Put('branding/:kind')
  @OrgRoute(P.ORG_MANAGE)
  setImage(@CurrentOrg() org: OrgContext, @Param('kind', new ParseEnumPipe(BrandImageKind)) kind: BrandImageKind, @Body() dto: BrandImageDto) {
    return this.branding.setImage(org, kind, dto.dataUrl);
  }

  @Delete('branding/:kind')
  @OrgRoute(P.ORG_MANAGE)
  removeImage(@CurrentOrg() org: OrgContext, @Param('kind', new ParseEnumPipe(BrandImageKind)) kind: BrandImageKind) {
    return this.branding.removeImage(org, kind);
  }

  // ---------------------------------------------------------------- unidades

  @Get('units')
  @OrgRoute()
  units(@CurrentOrg() org: OrgContext) {
    return this.catalog.listUnits(org);
  }

  @Post('units')
  @OrgRoute(P.UNITS_MANAGE)
  createUnit(@CurrentOrg() org: OrgContext, @Body() dto: UnitDto) {
    return this.catalog.createUnit(org, dto);
  }

  @Patch('units/:id')
  @OrgRoute(P.UNITS_MANAGE)
  updateUnit(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.catalog.updateUnit(org, id, dto);
  }

  // ---------------------------------------------------------------- equipe

  @Get('members')
  @OrgRoute(P.TEAM_VIEW)
  listMembers(@CurrentOrg() org: OrgContext) {
    return this.members.list(org);
  }

  @Post('members')
  @OrgRoute(P.TEAM_MANAGE)
  @Throttle({ default: { ttl: 3_600_000, limit: 60 } })
  createMember(@CurrentOrg() org: OrgContext, @Body() dto: MemberDto, @Req() req: Request) {
    return this.members.create(org, dto, contextOf(req));
  }

  @Patch('members/:id')
  @OrgRoute(P.TEAM_MANAGE)
  updateMember(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto, @Req() req: Request) {
    return this.members.update(org, id, dto, contextOf(req));
  }

  @Post('members/:id/resend-invite')
  @OrgRoute(P.TEAM_MANAGE)
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  resendInvite(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.members.resendInvite(org, id, contextOf(req));
  }

  @Delete('members/:id')
  @OrgRoute(P.TEAM_MANAGE)
  @HttpCode(204)
  removeMember(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.members.remove(org, id, contextOf(req));
  }

  /** Sair da equipe (qualquer perfil; o último dono não sai). */
  @Delete('membership')
  @OrgRoute()
  @HttpCode(204)
  leave(@CurrentOrg() org: OrgContext, @Req() req: Request) {
    return this.members.remove(org, org.memberId, contextOf(req));
  }

  // ---------------------------------------------------------------- serviços

  @Get('services')
  @OrgRoute(P.SERVICES_VIEW)
  services(@CurrentOrg() org: OrgContext) {
    return this.catalog.listServices(org);
  }

  @Post('services')
  @OrgRoute(P.SERVICES_MANAGE)
  createService(@CurrentOrg() org: OrgContext, @Body() dto: ServiceDto) {
    return this.catalog.createService(org, dto);
  }

  @Patch('services/:id')
  @OrgRoute(P.SERVICES_MANAGE)
  updateService(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.catalog.updateService(org, id, dto);
  }
}

/** Convites para a equipe: ver é público (só com o token), aceitar exige login. */
@ApiTags('convites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly members: MembersService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('info')
  info(@Query('token') token: string) {
    return this.members.inviteInfo(String(token ?? '').slice(0, 200));
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('accept')
  accept(@CurrentUser() user: JwtPayload, @Body() dto: AcceptInviteDto, @Req() req: Request) {
    return this.members.accept(user.sub, dto.token, contextOf(req));
  }
}

/** Logo e fundo da página pública. Só imagens validadas pelos bytes; `nosniff` e cache longo (o endereço muda com `?v=`). */
@ApiTags('página pública')
@Public()
@Controller('public/orgs')
export class PublicBrandController {
  constructor(private readonly branding: BrandingService) {}

  @Get(':slug/brand/:kind')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async image(
    @Param('slug') slug: string,
    @Param('kind', new ParseEnumPipe(BrandImageKind)) kind: BrandImageKind,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { mime, data } = await this.branding.publicImage(slug, kind);
    res.set({
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'same-site',
    });
    return new StreamableFile(data);
  }
}
