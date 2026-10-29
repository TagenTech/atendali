import configuration from './configuration';

describe('configuration()', () => {
  const env = { ...process.env };
  // Autossuficiente: o jest de unidade não carrega o `test/env.ts` dos e2e.
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-secret-unit-secret-unit-secret-unit-secret';
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('recusa JWT_SECRET ausente, curto ou de exemplo', () => {
    delete process.env.JWT_SECRET;
    expect(() => configuration()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'curto';
    expect(() => configuration()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'troque-isto-troque-isto-troque-isto-troque-isto';
    expect(() => configuration()).toThrow(/JWT_SECRET/);
  });

  it('sem nada além do obrigatório, assume produção e valores padrão', () => {
    for (const k of ['NODE_ENV', 'PORT', 'API_PREFIX', 'DATABASE_URL', 'CRON_SECRET', 'TYPEORM_SYNC', 'JWT_ACCESS_TTL_SECONDS', 'REFRESH_TTL_DAYS', 'PUBLIC_WEB_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'SIGNUP_ENABLED', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[k];
    const c = configuration();
    expect(c).toMatchObject({
      env: 'production',
      devFeatures: false,
      port: 3200,
      apiPrefix: 'v1',
      databaseUrl: 'postgres://postgres:postgres@localhost:5432/skedulei',
      cronSecret: null,
      typeormSync: false,
      refreshTtlDays: 30,
      publicWebUrl: 'http://localhost:3201',
      signupEnabled: true,
    });
    expect(c.jwt.accessTtlSeconds).toBe(900);
    expect(c.vapid).toEqual({ publicKey: null, privateKey: null, subject: 'mailto:contato@skedulei.app' });
    expect(c.oauth.google).toBeNull();
  });

  it('lê o que vier do ambiente', () => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      PORT: '4000',
      API_PREFIX: 'api',
      DATABASE_URL: 'postgres://x/y',
      CRON_SECRET: 'cron',
      JWT_ACCESS_TTL_SECONDS: '60',
      REFRESH_TTL_DAYS: '7',
      PUBLIC_WEB_URL: 'https://app.skedulei.com/',
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
      VAPID_SUBJECT: 'mailto:eu@x.com',
      SIGNUP_ENABLED: 'false',
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
    });
    delete process.env.TYPEORM_SYNC;
    const c = configuration();
    expect(c).toMatchObject({ env: 'development', devFeatures: true, port: 4000, apiPrefix: 'api', databaseUrl: 'postgres://x/y', cronSecret: 'cron', typeormSync: true, refreshTtlDays: 7, publicWebUrl: 'https://app.skedulei.com', signupEnabled: false });
    expect(c.jwt.accessTtlSeconds).toBe(60);
    expect(c.vapid).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:eu@x.com' });
    expect(c.oauth.google).toEqual({ clientId: 'gid', clientSecret: 'gsecret' });
  });

  it('TYPEORM_SYNC controla o synchronize em qualquer ambiente', () => {
    process.env.NODE_ENV = 'development';
    process.env.TYPEORM_SYNC = 'false';
    expect(configuration().typeormSync).toBe(false);
    process.env.NODE_ENV = 'production';
    process.env.TYPEORM_SYNC = 'true';
    expect(configuration().typeormSync).toBe(true);
  });
});
