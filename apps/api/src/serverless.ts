import './instrument';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

let appPromise: Promise<NestExpressApplication> | undefined;

async function getApp() {
  appPromise ??= (async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    configureApp(app);
    await app.init();
    return app;
  })();
  return appPromise;
}

export async function getHandler() {
  return (await getApp()).getHttpAdapter().getInstance();
}
