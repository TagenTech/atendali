import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@agendei/contracts';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'professor@agendei.app' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Informe a senha' })
  @MaxLength(128)
  password: string;
}
