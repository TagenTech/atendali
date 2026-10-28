import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  PAYMENT_METHODS,
  RECURRENCE_MAX,
  type CreatePayableRequest,
  type CreateReceivableRequest,
  type PaymentMethod,
  type SettlePayableRequest,
  type SettleReceivableRequest,
  type UpdatePayableRequest,
} from '@agendei/contracts';
import { EmptyToNull, IsIsoDate } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const MAX_CENTS = 1_000_000_000;

const cents = (message = 'Informe um valor maior que zero') => (target: object, key: string) => {
  IsInt({ message })(target, key);
  Min(1, { message })(target, key);
  Max(MAX_CENTS, { message: 'Valor alto demais' })(target, key);
};

export class CategoryDto {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: ['DESPESA', 'RECEITA'] })
  @IsIn(['DESPESA', 'RECEITA'])
  type: 'DESPESA' | 'RECEITA';
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AccountDto {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(80)
  name: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePayableDto implements CreatePayableRequest {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a conta' })
  @MaxLength(160)
  description: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiProperty()
  @cents()
  amountCents: number;

  @ApiProperty({ example: '2026-11-05' })
  @IsIsoDate()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Repete todo mês (total de parcelas, contando esta)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(RECURRENCE_MAX)
  monthlyCount?: number | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class UpdatePayableDto implements UpdatePayableRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a conta' })
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @cents()
  amountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  dueDate?: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class SettlePayableDto implements SettlePayableRequest {
  @ApiProperty()
  @IsIsoDate()
  paidDate: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Forma de pagamento inválida' })
  method: PaymentMethod;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  accountId?: string | null;
}

export class CreateReceivableDto implements CreateReceivableRequest {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a receita' })
  @MaxLength(160)
  description: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiProperty()
  @cents()
  amountCents: number;

  @ApiProperty()
  @IsIsoDate()
  expectedDate: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @EmptyToNull()
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class UpdateReceivableDto {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a receita' })
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  expectedDate?: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class SettleReceivableDto implements SettleReceivableRequest {
  @ApiProperty()
  @IsIsoDate()
  receivedDate: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  accountId?: string | null;
}

export class LedgerQueryDto {
  @ApiPropertyOptional({ description: 'Vencimento/previsão a partir de' })
  @IsOptional()
  @IsIsoDate()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  to?: string;

  @ApiPropertyOptional({ enum: ['PENDENTE', 'ATRASADO', 'PAGO', 'RECEBIDO'] })
  @IsOptional()
  @IsIn(['PENDENTE', 'ATRASADO', 'PAGO', 'RECEBIDO'])
  status?: 'PENDENTE' | 'ATRASADO' | 'PAGO' | 'RECEBIDO';
}

export class DeletePayableQueryDto {
  @ApiPropertyOptional({ description: 'Apaga também as parcelas seguintes ainda não pagas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  futuras?: boolean;
}

export class CashflowQueryDto {
  @ApiProperty({ enum: ['REALIZADO', 'PROJETADO'] })
  @IsIn(['REALIZADO', 'PROJETADO'])
  mode: 'REALIZADO' | 'PROJETADO';

  @ApiPropertyOptional({ description: 'Realizado: início do período' })
  @IsOptional()
  @IsIsoDate()
  from?: string;

  @ApiPropertyOptional({ description: 'Realizado: fim do período' })
  @IsOptional()
  @IsIsoDate()
  to?: string;

  @ApiPropertyOptional({ description: 'Projetado: 30, 60 ou 90 dias' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsIn([30, 60, 90])
  days?: 30 | 60 | 90;

  @ApiPropertyOptional({ enum: ['dia', 'semana'] })
  @IsOptional()
  @IsIn(['dia', 'semana'])
  bucket?: 'dia' | 'semana';
}
