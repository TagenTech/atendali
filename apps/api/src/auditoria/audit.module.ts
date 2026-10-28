import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditEntry } from './audit-entry.entity';
import { AuditService } from './audit.service';

@Global()
@Module({ imports: [TypeOrmModule.forFeature([AuditEntry])], controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
