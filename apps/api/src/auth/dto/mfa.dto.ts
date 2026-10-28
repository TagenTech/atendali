import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DeleteAccountRequest, MfaCodeRequest, MfaVerifyRequest } from '@agendei/contracts';

export class MfaCodeDto implements MfaCodeRequest {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código' })
  @MaxLength(20)
  code: string;
}

export class MfaVerifyDto extends MfaCodeDto implements MfaVerifyRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  mfaToken: string;
}

export class DeleteAccountDto implements DeleteAccountRequest {
  @ApiProperty()
  @IsEmail({}, { message: 'Digite seu e-mail para confirmar' })
  confirmEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}
