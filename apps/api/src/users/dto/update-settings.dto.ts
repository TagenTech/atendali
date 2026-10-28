import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsTimeZone, MaxLength } from 'class-validator';
import type { UpdateSettingsRequest } from '@agendei/contracts';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateSettingsDto implements UpdateSettingsRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsTimeZone({ message: 'Fuso horário inválido' })
  timezone?: string;
}
