import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AppointmentStatus,
  type ClientInput,
  type CreateAppointmentRequest,
  type CreateBlockRequest,
  type CreateWaitlistRequest,
  type PublicBookingRequest,
  type UpdateAppointmentRequest,
} from '@skedulei/contracts';
import { EmptyToNull, IsIsoDate, IsPhone } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
const STATUSES = Object.values(AppointmentStatus);

// ------------------------------------------------------------------ clientes

export class ClientDto implements ClientInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @lower()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email?: string | null;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @EmptyToNull()
  @IsOptional()
  @IsIsoDate()
  birthDate?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

export class UpdateClientDto implements Partial<ClientInput> {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;

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
  @IsIsoDate()
  birthDate?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

// ------------------------------------------------------------------ agendamentos

class NewClientDto {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do cliente' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsPhone()
  phone?: string | null;
}

export class CreateAppointmentDto implements CreateAppointmentRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ type: NewClientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewClientDto)
  newClient?: NewClientDto;

  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o profissional' })
  memberId: string;

  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o serviço' })
  serviceId: string;

  @ApiProperty({ example: '2026-11-03T13:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: 'Horário inválido' })
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOutsideHours?: boolean;
}

export class UpdateAppointmentDto implements UpdateAppointmentRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Horário inválido' })
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  durationMinutes?: number;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES, { message: 'Status inválido' })
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOutsideHours?: boolean;
}

export class CreateBlockDto implements CreateBlockRequest {
  @ApiPropertyOptional({ description: 'Sem profissional = a unidade inteira' })
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  memberId?: string | null;

  @ApiProperty()
  @IsISO8601({ strict: true }, { message: 'Início inválido' })
  startsAt: string;

  @ApiProperty()
  @IsISO8601({ strict: true }, { message: 'Fim inválido' })
  endsAt: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string | null;
}

export class CreateWaitlistDto implements CreateWaitlistRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ type: NewClientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewClientDto)
  newClient?: NewClientDto;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  memberId?: string | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsIsoDate()
  preferredDate?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class DayQueryDto {
  @ApiProperty({ example: '2026-11-03' })
  @IsIsoDate()
  date: string;

  @ApiPropertyOptional({ description: 'Dias a partir de `date` (1 = dia, 7 = semana)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class SlotsQueryDto extends DayQueryDto {
  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberId?: string;
}

// ------------------------------------------------------------------ público

export class PublicSlotsQueryDto {
  @ApiProperty()
  @IsIsoDate()
  date: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberId?: string;
}

export class PublicBookingDto implements PublicBookingRequest {
  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o serviço' })
  serviceId: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  memberId?: string | null;

  @ApiProperty()
  @IsISO8601({ strict: true }, { message: 'Horário inválido' })
  startsAt: string;

  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsPhone()
  phone: string;

  @ApiPropertyOptional()
  @lower()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email?: string | null;
}

export class ClientImportDto {
  @ApiProperty({ description: 'Conteúdo do arquivo CSV' })
  @IsString()
  @MaxLength(400_000)
  csv: string;
}
