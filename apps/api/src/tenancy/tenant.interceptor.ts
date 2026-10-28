import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from './tenant-db';

/** Rotas de negócio (o OrgGuard já preencheu `req.org`) rodam inteiras dentro da transação do negócio. */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantDb) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const org = context.switchToHttp().getRequest<{ org?: OrgContext }>().org;
    if (!org) return next.handle();
    return from(this.tenant.runAsTenant(org.organizationId, () => lastValueFrom(next.handle(), { defaultValue: undefined })));
  }
}
