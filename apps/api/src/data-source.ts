/**
 * DataSource para a CLI do TypeORM (migrations).
 *   pnpm --filter @agendei/api migration:generate src/migrations/NomeDaMudanca
 *   pnpm --filter @agendei/api migration:run
 */
import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { getDatabaseOptions } from './database/db-options';

export default new DataSource({
  ...getDatabaseOptions(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/agendei'),
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
});
