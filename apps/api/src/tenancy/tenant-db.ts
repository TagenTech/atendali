import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, type EntityTarget, type ObjectLiteral, type Repository } from 'typeorm';
import { applyTenantRls, TENANT_ROLE } from './tenant-rls';

interface TenantStore {
  em: EntityManager;
  organizationId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Acesso ao banco dentro de uma rota de negócio (@OrgRoute).
 * O TenantInterceptor abre uma transação com `app.org_id` = negócio ativo e o papel restrito
 * `agendei_tenant`: as políticas RLS do Postgres só deixam ver e gravar linhas desse negócio,
 * mesmo que uma consulta esqueça o `where organizationId`. Fora de rota de negócio (login,
 * onboarding, página pública), usa a conexão normal — e o filtro por negócio fica no código.
 */
@Injectable()
export class TenantDb implements OnApplicationBootstrap {
  private readonly logger = new Logger('Tenancy');
  /** Papel restrito disponível? Sem ele (banco sem permissão de criar papel), só o app.org_id é gravado. */
  private roleReady = false;

  constructor(private readonly db: DataSource) {}

  async onApplicationBootstrap() {
    try {
      await applyTenantRls(this.db);
      this.roleReady = true;
    } catch (err) {
      this.logger.error(`RLS por negócio não aplicado — o isolamento fica só no código: ${(err as Error).message}`);
    }
  }

  repo<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return (storage.getStore()?.em ?? this.db.manager).getRepository(entity);
  }

  /** Dentro de rota de negócio reaproveita a transação dela; fora, abre uma nova. */
  transaction<R>(fn: (em: EntityManager) => Promise<R>): Promise<R> {
    const store = storage.getStore();
    return store ? fn(store.em) : this.db.transaction(fn);
  }

  /** Roda `fn` numa transação presa ao negócio (usado pelo interceptor e pelos testes). */
  runAsTenant<R>(organizationId: string, fn: () => Promise<R>): Promise<R> {
    return this.db.transaction(async (em) => {
      await em.query(`SELECT set_config('app.org_id', $1, true)`, [organizationId]);
      if (this.roleReady) await em.query(`SET LOCAL ROLE ${TENANT_ROLE}`);
      return storage.run({ em, organizationId }, fn);
    });
  }
}
