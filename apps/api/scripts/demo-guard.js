/**
 * Os scripts de demonstração usam senha fixa e pública: só rodam contra máquina local.
 * Para um ambiente de teste remoto (nunca produção), defina ALLOW_DEMO_SEED=1.
 */
function assertLocal(target) {
  let host = '';
  try {
    host = /^[a-z]+:\/\//i.test(target) ? new URL(target).hostname : '';
  } catch {
    host = '';
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (process.env.NODE_ENV === 'production' || (!local && process.env.ALLOW_DEMO_SEED !== '1')) {
    console.error(`Recusado: "${target}" não é uma máquina local. Os usuários demo têm senha pública.`);
    process.exit(1);
  }
}
module.exports = { assertLocal };
