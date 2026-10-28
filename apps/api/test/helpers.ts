import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type request from 'supertest';
import { DataSource, type EntityTarget } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { defaultBusinessHours } from '@agendei/contracts';

export function quotedTable<T extends object>(db: DataSource, entity: EntityTarget<T>) {
  return `"${db.getMetadata(entity).tableName}"`;
}

/** Sobe a API completa (mesma configuração do main.ts) com o banco de teste zerado. */
export async function createTestApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  const tables = app.get(DataSource).entityMetadatas.map(({ tableName }) => `"${tableName}"`);
  await app.get(DataSource).query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  return app;
}

type Http = ReturnType<typeof request>;

/**
 * Cria uma conta pelo cadastro público e devolve o token e o cookie da sessão.
 * Usa o cadastro (e não o login) para não gastar o limite de 5 logins/min por IP.
 */
export async function registerUser(http: Http, name: string, email: string, password = 'senha-forte-123') {
  const res = await http.post('/v1/auth/register').send({ name, email, password, acceptTerms: true }).expect(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('agendei_refresh='))!.split(';')[0];
  return {
    id: res.body.user.id as string,
    token: res.body.accessToken as string,
    auth: { authorization: `Bearer ${res.body.accessToken}` },
    cookie,
    email,
    password,
  };
}

/** Corpo mínimo do onboarding (salão com 1 serviço). */
export function newOrg(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    segment: 'SALAO_BELEZA',
    unit: { name: 'Principal', city: 'São Paulo', state: 'sp', businessHours: defaultBusinessHours() },
    services: [{ name: 'Corte', category: 'Cabelo', durationMinutes: 45, priceCents: 8000 }],
    ownerBookable: true,
    ...extra,
  };
}
