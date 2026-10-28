/**
 * Monitoramento de erros (Sentry) — opcional: só liga com SENTRY_DSN.
 * Nunca envia dados pessoais: sem cookies, sem Authorization, sem corpo de requisição.
 */
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          for (const h of ['authorization', 'cookie', 'set-cookie']) delete event.request.headers[h];
        }
        // Tokens de e-mail e de 2FA nunca vão em query, mas por garantia:
        event.request.query_string = undefined;
      }
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

export function captureException(err: unknown) {
  if (dsn) Sentry.captureException(err);
}
