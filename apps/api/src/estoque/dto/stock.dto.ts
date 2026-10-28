import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import {
  MANUAL_MOVEMENTS,
  MAX_STOCK_QUANTITY,
  ProductKind,
  type CreateMovementRequest,
  type ManualMovement,
  type ProductInput,
  type SetSuppliesRequest,
  type UpdateProductRequest,
} from '@skedulei/contracts';
import { EmptyToNull } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const KINDS = Object.values(ProductKind);
const MAX_CENTS = 100_000_00;

export class ProductDto implements ProductInput {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao produto' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS, { message: 'Tipo inválido' })
  kind: ProductKind;

  @ApiPropertyOptional({ example: 'un' })
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  unit?: string;

  @ApiPropertyOptional({ description: 'Centavos' })
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  salePriceCents?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK_QUANTITY)
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Custo por unidade (centavos)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  costCents?: number;
}

export class UpdateProductDto implements UpdateProductRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao produto' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  unit?: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  salePriceCents?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK_QUANTITY)
  minQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  costCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MovementDto implements CreateMovementRequest {
  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o produto' })
  productId: string;

  @ApiProperty({ enum: MANUAL_MOVEMENTS })
  @IsIn(MANUAL_MOVEMENTS, { message: 'Tipo de movimento inválido' })
  kind: ManualMovement;

  /** Entrada/saída: quantidade (> 0). Inventário: quantidade contada (≥ 0). */
  @ApiProperty()
  @IsInt({ message: 'Quantidade inválida' })
  @Min(0, { message: 'Quantidade inválida' })
  @Max(MAX_STOCK_QUANTITY)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  unitCostCents?: number;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class MovementsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;
}

class SupplyLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1, { message: 'A quantidade por atendimento precisa ser pelo menos 1' })
  @Max(MAX_STOCK_QUANTITY)
  quantity: number;
}

export class SuppliesDto implements SetSuppliesRequest {
  @ApiProperty({ type: [SupplyLineDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SupplyLineDto)
  supplies: SupplyLineDto[];
}
