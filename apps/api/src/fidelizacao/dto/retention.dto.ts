import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  MAX_RATING,
  MIN_RATING,
  type MembershipPlanInput,
  type PackagePlanInput,
  type RedeemPointsRequest,
  type SubmitReviewRequest,
  type UpdateMembershipPlanRequest,
  type UpdatePackagePlanRequest,
} from '@skedulei/contracts';
import { EmptyToNull } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const MAX_CENTS = 100_000_00;

export class PackagePlanDto implements PackagePlanInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao pacote' })
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o serviço' })
  serviceId: string;

  @ApiProperty()
  @IsInt({ message: 'Número de sessões inválido' })
  @Min(2, { message: 'Um pacote tem pelo menos 2 sessões' })
  @Max(200)
  sessions: number;

  @ApiProperty({ description: 'Centavos' })
  @IsInt({ message: 'Preço inválido' })
  @Min(0)
  @Max(MAX_CENTS)
  priceCents: number;

  @ApiPropertyOptional({ description: 'Dias de validade; vazio = sem validade' })
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number | null;
}

export class UpdatePackagePlanDto implements UpdatePackagePlanRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao pacote' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(200)
  sessions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  priceCents?: number;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MembershipPlanDto implements MembershipPlanInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao plano' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Mensalidade em centavos' })
  @IsInt({ message: 'Preço inválido' })
  @Min(0)
  @Max(MAX_CENTS)
  priceCents: number;

  @ApiPropertyOptional({ description: 'Vazio = vale para qualquer serviço' })
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional({ description: 'Vazio = ilimitado' })
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  sessionsPerMonth?: number | null;
}

export class UpdateMembershipPlanDto implements UpdateMembershipPlanRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao plano' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  priceCents?: number;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  sessionsPerMonth?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MembershipStatusDto {
  @ApiProperty({ enum: ['ATIVA', 'PAUSADA', 'CANCELADA'] })
  @IsIn(['ATIVA', 'PAUSADA', 'CANCELADA'], { message: 'Situação inválida' })
  status: 'ATIVA' | 'PAUSADA' | 'CANCELADA';
}

export class ClientFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class GiftLookupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  code: string;
}

export class RedeemDto implements RedeemPointsRequest {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  points: number;
}

export class AdjustPointsDto {
  @ApiProperty({ description: 'Com sinal: + dá pontos, − tira' })
  @IsInt()
  @Min(-10_000_000)
  @Max(10_000_000)
  points: number;

  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Diga o motivo do ajuste' })
  @MaxLength(200)
  note: string;
}

export class SubmitReviewDto implements SubmitReviewRequest {
  @ApiProperty()
  @IsInt({ message: 'Dê uma nota de 1 a 5' })
  @Min(MIN_RATING, { message: 'Dê uma nota de 1 a 5' })
  @Max(MAX_RATING, { message: 'Dê uma nota de 1 a 5' })
  rating: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class ReviewVisibilityDto {
  @ApiProperty()
  @IsBoolean()
  published: boolean;
}
