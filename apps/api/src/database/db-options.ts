import { join } from 'path';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const TABLE_PREFIX = 'skedulei_';

export function getDatabaseOptions(url: string): Pick<
  PostgresConnectionOptions,
  'type' | 'url' | 'ssl' | 'entityPrefix' | 'migrationsTableName' | 'uuidExtension' | 'migrations' | 'extra'
> {
  return {
    type: 'postgres',
    url,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entityPrefix: TABLE_PREFIX,
    migrationsTableName: 'skedulei_migrations',
    uuidExtension: 'pgcrypto',
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    extra: { max: Number(process.env.DB_POOL_MAX ?? 10) },
  };
}
