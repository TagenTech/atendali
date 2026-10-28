import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  CashMovementKind,
  OrderItemKind,
  PAYMENT_METHODS,
  type AddPaymentRequest,
  type CashMovementRequest,
  type CloseCashRequest,
  type CreateOrderRequest,
  type OpenCashRequest,
  type OrderItemInput,
  type PaymentMethod,
  type UpdateOrderRequest,
} from '@agendei/contracts';
import { EmptyToNull, IsIsoDate } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const MAX_CENTS = 100_000_00;

const cents = (opts: { min?: number; message?: string } = {}) => (target: object, key: string) => {
  IsInt({ message: opts.message ?? 'Valor inválido' })(target, key);
  Min(opts.min ?? 0, { message: opts.message ?? 'Valor inválido' })(target, key);
  Max(MAX_CENTS)(target, key);
};

export class OpenCashDto implements OpenCashRequest {
  @ApiProperty({ description: 'Troco inicial (centavos)' })
  @cents()
  openingCents: number;
}

export class CashMovementDto implements CashMovementRequest {
  @ApiProperty({ enum: Object.values(CashMovementKind) })
  @IsIn(Object.values(CashMovementKind))
  kind: CashMovementKind;

  @ApiProperty()
  @cents({ min: 1, message: 'Informe o valor' })
  amountCents: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class CloseCashDto implements CloseCashRequest {
  @ApiProperty({ description: 'Dinheiro contado na gaveta' })
  @cents()
  countedCents: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class CreateOrderDto implements CreateOrderRequest {
  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  appointmentIds?: string[];
}

export class OrderItemDto implements OrderItemInput {
  @ApiProperty({ enum: Object.values(OrderItemKind) })
  @IsIn(Object.values(OrderItemKind))
  kind: OrderItemKind;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Descreva o item' })
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  memberId?: string | null;

  @ApiPropertyOptional({ description: 'Produto, plano, pacote/assinatura do cliente (conforme o tipo)' })
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  refId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @cents()
  unitPriceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @cents()
  discountCents?: number;
}

export class UpdateOrderDto implements UpdateOrderRequest {
  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @cents()
  discountCents?: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class AddPaymentDto implements AddPaymentRequest {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Forma de pagamento inválida' })
  method: PaymentMethod;

  @ApiProperty()
  @cents({ min: 1, message: 'Informe o valor' })
  amountCents: number;

  @ApiPropertyOptional({ description: 'Código do vale-presente (só com VALE_PRESENTE)' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  giftCode?: string | null;
}

export class OrdersQueryDto {
  @ApiPropertyOptional({ enum: ['ABERTA', 'FECHADA', 'CANCELADA'] })
  @IsOptional()
  @IsIn(['ABERTA', 'FECHADA', 'CANCELADA'])
  status?: 'ABERTA' | 'FECHADA' | 'CANCELADA';

  @ApiPropertyOptional({ description: 'Comandas fechadas nesse dia (fuso da unidade)' })
  @IsOptional()
  @IsIsoDate()
  date?: string;
}

export class AdvanceDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;

  @ApiProperty()
  @cents({ min: 1, message: 'Informe o valor' })
  amountCents: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  date?: string;
}

export class PayoutDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;
}

export class PeriodQueryDto {
  @ApiProperty()
  @IsIsoDate()
  from: string;

  @ApiProperty()
  @IsIsoDate()
  to: string;
}

export class CommissionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
