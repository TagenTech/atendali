import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@skedulei/contracts';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'professor@skedulei.app' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Informe a senha' })
  @MaxLength(128)
  password: string;
}
