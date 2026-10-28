import { assertEncryptionKey } from '../common/crypto/field-crypto';

export interface AppConfig {
  env: string;
  /** Swagger, caixa de saída de e-mails etc. — só com NODE_ENV=development|test explícito. */
  devFeatures: boolean;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  cronSecret: string | null;
  typeormSync: boolean;
  jwt: { secret: string; accessTtlSeconds: number };
  refreshTtlDays: number;
  publicWebUrl: string;
  vapid: { publicKey: string | null; privateKey: string | null; subject: string };
  signupEnabled: boolean;
  oauth: Record<'google' | 'microsoft' | 'facebook', { clientId: string; clientSecret: string } | null>;
}

const WEAK_SECRETS = ['troque', 'changeme', 'secret123', 'example'];

export function isDevEnv(env = process.env.NODE_ENV) {
  return env === 'development' || env === 'test';
}

function creds(prefix: string) {
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export default (): AppConfig => {
  // Sem NODE_ENV, assume produção: nada de Swagger, rotas de dev ou synchronize por engano.
  const env = process.env.NODE_ENV ?? 'production';
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || WEAK_SECRETS.some((w) => secret.includes(w))) {
    throw new Error('JWT_SECRET ausente ou fraco (mín. 32 caracteres aleatórios: openssl rand -base64 48)');
  }
  // Valida já na subida: sem chave, nada de CPF em texto puro.
  assertEncryptionKey();
  return {
    env,
    devFeatures: isDevEnv(env),
    port: Number(process.env.PORT ?? 3200),
    apiPrefix: process.env.API_PREFIX ?? 'v1',
    databaseUrl:
      process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/agendei',
    cronSecret: process.env.CRON_SECRET ?? null,
    typeormSync:
      process.env.TYPEORM_SYNC === 'true' ||
      (env === 'development' && process.env.TYPEORM_SYNC !== 'false'),
    jwt: {
      secret,
      accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    },
    refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 30),
    publicWebUrl: (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3201').replace(/\/$/, ''),
    vapid: {
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      privateKey: process.env.VAPID_PRIVATE_KEY || null,
      subject: process.env.VAPID_SUBJECT || 'mailto:contato@agendei.app',
    },
    signupEnabled: process.env.SIGNUP_ENABLED !== 'false',
    oauth: {
      google: creds('GOOGLE'),
      microsoft: creds('MICROSOFT'),
      facebook: creds('FACEBOOK'),
    },
  };
};
