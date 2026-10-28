import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Permission as P } from '@skedulei/contracts';
import { IsIsoDate } from '../common/validators/br.validators';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { RelatoriosService } from './relatorios.service';

class PeriodDto {
  @IsIsoDate()
  from: string;

  @IsIsoDate()
  to: string;
}

class DaysDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;
}

@ApiTags('relatórios')
@ApiBearerAuth()
@Controller('org/reports')
export class RelatoriosController {
  constructor(private readonly reports: RelatoriosService) {}

  @Get('overview')
  @OrgRoute(P.REPORTS_VIEW)
  overview(@CurrentOrg() org: OrgContext, @Query() q: PeriodDto) {
    return this.reports.overview(org, q.from, q.to);
  }

  @Get('inactive')
  @OrgRoute(P.REPORTS_VIEW)
  inactive(@CurrentOrg() org: OrgContext, @Query() q: DaysDto) {
    return this.reports.inactive(org, q.dias ?? 60);
  }

  @Get('birthdays')
  @OrgRoute(P.REPORTS_VIEW)
  birthdays(@CurrentOrg() org: OrgContext, @Query() q: DaysDto) {
    return this.reports.birthdays(org, q.dias ?? 30);
  }
}
