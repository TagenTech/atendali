import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration, { AppConfig } from './config/configuration';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { SecurityModule } from './security/security.module';
import { UsersModule } from './users/users.module';
import { getDatabaseOptions } from './database/db-options';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { AuditModule } from './auditoria/audit.module';
import { LembretesModule } from './lembretes/lembretes.module';
import { ClinicoModule } from './clinico/clinico.module';
import { ContactModule } from './contact/contact.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrgGuard } from './organizations/org-context';
import { TenancyModule } from './tenancy/tenancy.module';
import { AgendaModule } from './agenda/agenda.module';
import { FinanceModule } from './financeiro/finance.module';
import { StockModule } from './estoque/stock.module';
import { FidelizacaoModule } from './fidelizacao/fidelizacao.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [join(__dirname, '..', '.env.local'), join(__dirname, '..', '.env')],
    }),
    // Limite global por IP. Testes de navegador (tudo do mesmo IP) sobem com THROTTLE_LIMIT maior.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 300) }]),
    ...(process.env.SCHEDULER_ENABLED !== 'false' ? [ScheduleModule.forRoot()] : []),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...getDatabaseOptions(config.get<AppConfig['databaseUrl']>('databaseUrl')!),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('typeormSync'),
        // Produção: schema só muda por migration, aplicada na subida da API.
        migrationsRun: !config.get<boolean>('typeormSync') && process.env.TYPEORM_MIGRATIONS_RUN !== 'false',
      }),
    }),
    MailModule,
    SecurityModule,
    AuthModule,
    TenancyModule,
    UsersModule,
    OrganizationsModule,
    AgendaModule,
    StockModule,
    FidelizacaoModule,
    ClinicoModule,
    LembretesModule,
    AuditModule,
    RelatoriosModule,
    FinanceModule,
    ContactModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Depois do JWT: rotas @OrgRoute exigem negócio ativo e permissão.
    { provide: APP_GUARD, useClass: OrgGuard },
  ],
})
export class AppModule {}
