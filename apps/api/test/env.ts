// Carregado antes de cada arquivo e2e (jest `setupFiles`): banco de teste e segredos fixos.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/skedulei_test';
process.env.TYPEORM_SYNC = 'true';
process.env.JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e-secret';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
