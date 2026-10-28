import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import {
  PASSWORD_COMMON_MESSAGE,
  PASSWORD_MIN_LENGTH,
  isCommonPassword,
  type ForgotPasswordRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
} from '@agendei/contracts';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
@ValidatorConstraint({ name: 'notCommonPassword' })
export class NotCommonPassword implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value !== 'string' || !isCommonPassword(value);
  }
  defaultMessage() {
    return PASSWORD_COMMON_MESSAGE;
  }
}

const passwordRules = () => (target: object, key: string) => {
  IsString()(target, key);
  MinLength(PASSWORD_MIN_LENGTH, { message: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres` })(target, key);
  MaxLength(128)(target, key);
  Validate(NotCommonPassword)(target, key);
};

export class RegisterDto implements RegisterRequest {
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
  @passwordRules()
  password: string;

  @ApiProperty()
  @IsBoolean()
  @Equals(true, { message: 'Aceite os termos para continuar' })
  acceptTerms: boolean;
}

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty()
  @trim()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(180)
  email: string;
}

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;

  @ApiProperty()
  @passwordRules()
  password: string;
}

export class VerifyEmailDto implements VerifyEmailRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}
