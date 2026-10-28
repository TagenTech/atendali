import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantDb } from './tenant-db';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [TenantDb, { provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
  exports: [TenantDb],
})
export class TenancyModule {}
