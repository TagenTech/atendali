import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, Validate } from 'class-validator';
import { NotCommonPassword } from './register.dto';
import { PASSWORD_MIN_LENGTH, type ChangePasswordRequest } from '@skedulei/contracts';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ required: false, description: 'Não precisa para quem ainda não tem senha (login social)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A nova senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128)
  @Validate(NotCommonPassword)
  newPassword: string;
}
