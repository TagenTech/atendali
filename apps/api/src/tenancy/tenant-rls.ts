import type { DataSource } from 'typeorm';
import { Organization } from '../organizations/entities/organization.entity';

/** Papel sem login e sem BYPASSRLS que a API assume (SET LOCAL ROLE) dentro das rotas de negócio. */
export const TENANT_ROLE = 'skedulei_tenant';
const POLICY = 'skedulei_tenant_isolation';
const ORG_ID = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

/**
 * Cria o papel, dá acesso às tabelas de negócio e (re)cria as políticas RLS. Idempotente:
 * roda na subida da API (dev sincroniza o schema sozinho; produção depois das migrations).
 * Tabela de negócio = tem a coluna `organization_id` (a de negócios usa o próprio `id`).
 */
export async function applyTenantRls(db: DataSource) {
  const tables = db.entityMetadatas
    .filter((m) => m.target === Organization || m.columns.some((c) => c.databaseName === 'organization_id'))
    .map((m) => ({ name: m.tableName, column: m.target === Organization ? 'id' : 'organization_id' }));

  await db.transaction(async (em) => {
    await em.query(`
      DO $role$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_ROLE}') THEN
          CREATE ROLE ${TENANT_ROLE} NOLOGIN NOBYPASSRLS;
        END IF;
      END $role$;`);
    // Quem conecta (dono das tabelas) precisa poder assumir o papel.
    await em.query(`DO $grant$ BEGIN
        IF NOT pg_has_role(current_user, '${TENANT_ROLE}', 'MEMBER') THEN
          EXECUTE format('GRANT ${TENANT_ROLE} TO %I', current_user);
        END IF;
      END $grant$;`);
    await em.query(`GRANT USAGE ON SCHEMA public TO ${TENANT_ROLE}`);
    for (const { name, column } of tables) {
      await em.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${name}" TO ${TENANT_ROLE}`);
      await em.query(`ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`);
      await em.query(`DROP POLICY IF EXISTS ${POLICY} ON "${name}"`);
      await em.query(
        `CREATE POLICY ${POLICY} ON "${name}" TO ${TENANT_ROLE} USING ("${column}" = ${ORG_ID}) WITH CHECK ("${column}" = ${ORG_ID})`,
      );
    }
  });
}
