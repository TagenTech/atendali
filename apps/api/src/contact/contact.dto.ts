import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ContactDto {
  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @trim()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(10, { message: 'Conte um pouco mais para a gente' })
  @MaxLength(2000)
  message: string;
}
