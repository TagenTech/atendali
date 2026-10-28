import { BadRequestException, Body, Controller, Get, Header, Patch, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { isValidCpf, SecurityEventType } from '@agendei/contracts';
import type { Request } from 'express';
import { contextOf } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ExportService } from './export.service';
import { UsersService } from './users.service';

@ApiTags('conta')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly exporter: ExportService,
    private readonly events: SecurityEventsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: JwtPayload) {
    return this.service.toDto(await this.service.findById(user.sub));
  }

  @Patch('profile')
  async completeProfile(@CurrentUser() user: JwtPayload, @Body() dto: CompleteProfileDto, @Req() req: Request) {
    if (!isValidCpf(dto.cpf)) throw new BadRequestException('CPF inválido — confira os números');
    const t = await this.service.completeProfile(user.sub, dto);
    await this.events.record(SecurityEventType.PROFILE_COMPLETED, user.sub, contextOf(req));
    return this.service.toDto(t);
  }

  @Get('export')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Header('Content-Disposition', 'attachment; filename="agendei-meus-dados.json"')
  export(@CurrentUser() user: JwtPayload) {
    return this.exporter.export(user.sub);
  }

  @Patch('settings')
  async updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSettingsDto) {
    return this.service.toDto(await this.service.updateSettings(user.sub, dto));
  }
}
