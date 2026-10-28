import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isDevEnv, type AppConfig } from '../config/configuration';
import { UsersModule } from '../users/users.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DevController } from './dev.controller';
import { AuthIdentity } from './entities/auth-identity.entity';
import { EmailToken } from './entities/email-token.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken, EmailToken, AuthIdentity, MfaRecoveryCode]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<AppConfig['jwt']>('jwt')!.secret,
      }),
    }),
  ],
  controllers: [AuthController, ...(isDevEnv() ? [DevController] : [])],
  providers: [AuthService, OAuthService, AccountService],
})
export class AuthModule {}
