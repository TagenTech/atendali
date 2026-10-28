import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AUDIT_GROUP_KEYS, Permission as P, type AuditGroup } from '@skedulei/contracts';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { AuditService } from './audit.service';

class AuditQueryDto {
  @IsOptional()
  @IsIn(AUDIT_GROUP_KEYS)
  grupo?: AuditGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;
}

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('org/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @OrgRoute(P.AUDIT_VIEW)
  list(@CurrentOrg() org: OrgContext, @Query() q: AuditQueryDto) {
    return this.audit.list(org, q);
  }
}
