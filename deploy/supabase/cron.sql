-- Jobs agendados do Skedulei no Supabase (pg_cron + pg_net). Rode no SQL Editor DEPOIS de habilitar as extensões
-- pg_cron e pg_net (Database → Extensions). Na Vercel, a API usa SCHEDULER_ENABLED=false: quem dispara é este arquivo.
--
-- 1) Guarde o segredo no Vault (mesmo valor de CRON_SECRET da API, com 32+ caracteres):
--      select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'skedulei_cron_secret');
-- 2) Troque API_URL pelo endereço público da API (ex.: https://api.seudominio.com.br).

-- Lembretes por e-mail (24 h e 2 h antes) — a cada 5 minutos.
select cron.schedule(
  'skedulei-lembretes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'API_URL/v1/internal/jobs/reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'skedulei_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Para parar: select cron.unschedule('skedulei-lembretes');
