// Recria do zero o banco usado pelos testes de navegador (Playwright).
//   node apps/api/test/reset-db.js postgres://postgres:postgres@localhost:5432/agendei_e2e_web
const { Client } = require('pg');

async function main() {
  const url = new URL(process.argv[2]);
  const name = url.pathname.slice(1);
  if (!/^agendei_[a-z0-9_]*e2e[a-z0-9_]*$/.test(name)) throw new Error(`Banco não parece de teste: ${name}`);
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
