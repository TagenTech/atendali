// Carrega o .env antes de qualquer módulo (algumas rotas dependem do NODE_ENV no carregamento).
import 'dotenv/config';
// Sentry precisa iniciar antes dos demais módulos.
import './instrument';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { prefix, port } = configureApp(app);
  await app.listen(port);
  Logger.log(`API em http://localhost:${port}/${prefix}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
