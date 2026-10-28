import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import {
  BRAND_COLOR_KEYS,
  CommissionBase,
  FEATURES,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentMethodConfig,
  MEMBER_COLOR_COUNT,
  ROLES,
  SEGMENTS,
  TAGLINE_MAX,
  validateBusinessHours,
  type AcceptInviteRequest,
  type BrandColor,
  type BusinessHours,
  type CreateMemberRequest,
  type CreateOrganizationRequest,
  type Feature,
  type Role,
  type SampleService,
  type Segment,
  type ServiceInput,
  type UnitInput,
  type UploadBrandImageRequest,
  type UpdateMemberRequest,
  type UpdateOrganizationRequest,
  type UpdateServiceRequest,
  type UpdateUnitRequest,
} from '@skedulei/contracts';
import { EmptyToNull, IsPhone } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
const digits = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') || null : value));

function IsBusinessHours(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isBusinessHours',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (v: unknown) => validateBusinessHours(v) === null,
        defaultMessage: (args) => validateBusinessHours(args?.value) ?? 'Horário inválido',
      },
    });
  };
}

// ------------------------------------------------------------------ unidade

export class UnitDto implements UnitInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para a unidade' })
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @digits()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'CEP inválido' })
  zipCode?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  street?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value))
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'UF inválida' })
  state?: string | null;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsTimeZone({ message: 'Fuso horário inválido' })
  timezone?: string;

  @ApiProperty({ description: '7 dias (0 = domingo), cada um com faixas { start, end } em HH:mm' })
  @IsBusinessHours()
  businessHours: BusinessHours;
}

export class UpdateUnitDto implements UpdateUnitRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para a unidade' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @digits()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'CEP inválido' })
  zipCode?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  street?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value))
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'UF inválida' })
  state?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsTimeZone({ message: 'Fuso horário inválido' })
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBusinessHours()
  businessHours?: BusinessHours;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ------------------------------------------------------------------ serviços

export class ServiceDto implements ServiceInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para o serviço' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string | null;

  @ApiProperty({ example: 60 })
  @IsInt({ message: 'Duração inválida' })
  @Min(5, { message: 'Duração mínima de 5 minutos' })
  @Max(720, { message: 'Duração máxima de 12 horas' })
  durationMinutes: number;

  @ApiProperty({ example: 9000, description: 'Centavos' })
  @IsInt({ message: 'Preço inválido' })
  @Min(0, { message: 'Preço não pode ser negativo' })
  @Max(100_000_00)
  priceCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlineBooking?: boolean;

  @ApiPropertyOptional({ description: 'Comissão em bps (100 = 1%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionBps?: number | null;
}

export class UpdateServiceDto implements UpdateServiceRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para o serviço' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'Duração inválida' })
  @Min(5, { message: 'Duração mínima de 5 minutos' })
  @Max(720, { message: 'Duração máxima de 12 horas' })
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'Preço inválido' })
  @Min(0, { message: 'Preço não pode ser negativo' })
  @Max(100_000_00)
  priceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlineBooking?: boolean;

  @ApiPropertyOptional({ description: 'Comissão em bps (100 = 1%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionBps?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class SampleServiceDto extends ServiceDto implements SampleService {
  @ApiProperty()
  @trim()
  @IsString()
  @MaxLength(60)
  declare category: string;
}

// ------------------------------------------------------------------ equipe

export class MemberDto implements CreateMemberRequest {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ description: 'Com e-mail, a pessoa recebe convite para entrar no app' })
  @lower()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email?: string | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES, { message: 'Perfil de acesso inválido' })
  role: Role;

  @ApiProperty()
  @IsBoolean()
  bookable: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MEMBER_COLOR_COUNT)
  color?: number;

  @ApiPropertyOptional({ description: 'null = segue o horário da unidade' })
  @IsOptional()
  @IsBusinessHours()
  workingHours?: BusinessHours | null;

  @ApiPropertyOptional({ description: 'Comissão em bps (100 = 1%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionBps?: number | null;
}

export class UpdateMemberDto implements UpdateMemberRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @lower()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email?: string | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES, { message: 'Perfil de acesso inválido' })
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bookable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MEMBER_COLOR_COUNT)
  color?: number;

  @ApiPropertyOptional({ description: 'null = segue o horário da unidade' })
  @IsOptional()
  @IsBusinessHours()
  workingHours?: BusinessHours | null;

  @ApiPropertyOptional({ description: 'Comissão em bps (100 = 1%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionBps?: number | null;
}

export class AcceptInviteDto implements AcceptInviteRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

// ------------------------------------------------------------------ negócio

export class PaymentMethodConfigDto implements PaymentMethodConfig {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(2_000, { message: 'Taxa máxima de 20%' })
  feeBps: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10_000)
  feeFixedCents: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(120)
  settlementDays: number;
}

export class CreateOrganizationDto implements CreateOrganizationRequest {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do negócio' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: SEGMENTS })
  @IsIn(SEGMENTS, { message: 'Escolha o tipo de negócio' })
  segment: Segment;

  @ApiPropertyOptional({ enum: FEATURES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(FEATURES, { each: true, message: 'Módulo desconhecido' })
  features?: Feature[];

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiProperty({ type: UnitDto })
  @ValidateNested()
  @Type(() => UnitDto)
  unit: UnitDto;

  @ApiProperty({ type: [SampleServiceDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SampleServiceDto)
  services: SampleServiceDto[];

  @ApiProperty()
  @IsBoolean()
  ownerBookable: boolean;

  @ApiPropertyOptional({ type: [MemberDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  team?: MemberDto[];
}

export class LoyaltyRuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100)
  pointsPerReal: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100_000)
  redeemPoints: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10_000_00)
  redeemValueCents: number;
}

export class UpdateOrganizationDto implements UpdateOrganizationRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do negócio' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'CNPJ ou CPF' })
  @digits()
  @IsOptional()
  @Matches(/^(\d{11}|\d{14})$/, { message: 'CNPJ ou CPF inválido' })
  document?: string | null;

  @ApiPropertyOptional({ enum: FEATURES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(FEATURES, { each: true, message: 'Módulo desconhecido' })
  features?: Feature[];

  @ApiPropertyOptional({ type: [PaymentMethodConfigDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PAYMENT_METHODS.length)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodConfigDto)
  paymentMethods?: PaymentMethodConfigDto[];

  @ApiPropertyOptional({ enum: Object.values(CommissionBase) })
  @IsOptional()
  @IsIn(Object.values(CommissionBase))
  commissionBase?: CommissionBase;

  @ApiPropertyOptional({ type: LoyaltyRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LoyaltyRuleDto)
  loyalty?: LoyaltyRuleDto;

  @ApiPropertyOptional({ description: 'Chave de BRAND_COLORS; null volta ao padrão' })
  @EmptyToNull()
  @IsOptional()
  @IsIn(BRAND_COLOR_KEYS, { message: 'Escolha uma das cores da lista' })
  brandColor?: BrandColor | null;

  @ApiPropertyOptional({ description: 'Frase de boas-vindas da página pública' })
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(TAGLINE_MAX)
  tagline?: string | null;
}

export class BrandImageDto implements UploadBrandImageRequest {
  @ApiProperty({ description: 'data:image/(png|jpeg|webp);base64,…' })
  @IsString()
  @MaxLength(900_000)
  dataUrl: string;
}
