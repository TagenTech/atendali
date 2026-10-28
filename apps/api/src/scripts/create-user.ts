/**
 * Cria (ou atualiza a senha de) uma conta pela linha de comando.
 *
 *   pnpm api:create-user --name "Filipe" --email voce@email.com --password "senha-forte"
 *
 * Sem argumentos, usa DEV_USER_* do .env (somente fora de produção).
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PASSWORD_MIN_LENGTH } from '@agendei/contracts';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const devDefaults = process.env.NODE_ENV !== 'production';
  const name = arg('name') ?? (devDefaults ? process.env.DEV_USER_NAME : undefined);
  const email = arg('email') ?? (devDefaults ? process.env.DEV_USER_EMAIL : undefined);
  const password = arg('password') ?? (devDefaults ? process.env.DEV_USER_PASSWORD : undefined);
  if (!name || !email || !password) {
    console.error('Uso: pnpm api:create-user --name "Nome" --email email --password senha');
    process.exit(1);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const { user, created } = await app.get(UsersService).upsert(name, email, password);
  console.log(`${created ? 'Professor criado' : 'Professor atualizado'}: ${user.name} <${user.email}>`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
