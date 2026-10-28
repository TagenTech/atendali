import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeCpf, type CompleteProfileRequest } from '@agendei/contracts';
import { EmptyToNull, IsPhone } from '../../common/validators/br.validators';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export class CompleteProfileDto implements CompleteProfileRequest {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome completo' })
  @Matches(/\S+\s+\S+/, { message: 'Informe nome e sobrenome' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '529.982.247-25' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeCpf(value) : value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF inválido' })
  cpf: string;

  @ApiProperty({ example: '(11) 98765-4321' })
  @IsPhone({ message: 'Celular inválido' })
  phone: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsIn(UFS, { message: 'UF inválida' })
  state?: string | null;
}
