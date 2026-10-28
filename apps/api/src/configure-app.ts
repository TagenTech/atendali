import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Middlewares e configurações globais — usados pelo main.ts e pelos testes e2e (mesmo comportamento). */
export function configureApp(app: NestExpressApplication) {
  // Rate-limit por IP real atrás do proxy (Next em dev, nginx em produção). Ajuste se houver mais saltos (ex.: Cloudflare + nginx = 2).
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'v1';

  const swagger = config.get<boolean>('devFeatures') || process.env.SWAGGER_ENABLED === 'true';
  // A API só devolve JSON: CSP fechada. Com Swagger (dev), libera os scripts inline dele.
  app.use(
    helmet({
      contentSecurityPolicy: swagger ? false : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  // Importação de clientes manda o CSV no corpo (até ~400 mil caracteres); o resto da API usa corpos pequenos.
  app.useBodyParser('json', { limit: '1mb' });
  app.use(cookieParser());
  // O web chama a API pela mesma origem (proxy); CORS só para origens listadas explicitamente.
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  if (swagger) {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Agendei API').setVersion('1.0').addBearerAuth().build());
    SwaggerModule.setup(`${prefix}/api/docs`, app, doc);
  }
  return { prefix, port: config.get<number>('port') ?? 3200 };
}
