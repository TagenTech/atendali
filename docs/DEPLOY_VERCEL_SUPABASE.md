# Deploy: Cloudflare + Vercel (free) + Supabase

> Os jobs agendados (pg_cron → `/v1/internal/jobs/reminders`) já existem: são os **lembretes por e-mail**. A seção 6 é obrigatória neste deploy (a API na Vercel não fica ligada entre as chamadas).

Alternativa ao deploy em VPS ([LANCAMENTO.md](LANCAMENTO.md)). Topologia:

```text
skedulei.com.br (Cloudflare DNS) → Vercel "skedulei-web" (Next) ──/api/v1/*──→ Vercel "skedulei-api" (NestJS serverless)
                                                                              │
Supabase pg_cron + pg_net ── a cada minuto/hora/dia ──→ POST /v1/internal/jobs/* ┘ → Supabase Postgres (tabelas skedulei_*)
```

- Tabelas com prefixo `skedulei_` (inclusive `skedulei_migrations`), RLS ligado e sem acesso para `anon`/`authenticated`: a API REST do Supabase não enxerga nada.
- Os `@Cron` ficam desligados na Vercel (`SCHEDULER_ENABLED=false`); quem dispara é o pg_cron ([deploy/supabase/cron.sql](../deploy/supabase/cron.sql)).
- Migrations rodam no GitHub Actions ([migrate.yml](../.github/workflows/migrate.yml)) a cada push na `main` (nunca na `develop`, que não toca o banco de produção), não na subida da API. Sem o segredo `SUPABASE_MIGRATIONS_URL` o fluxo termina verde, com um aviso "Migrations puladas".
- Plano Hobby da Vercel é para uso não comercial: ao começar a cobrar a licença, migre para o Pro.

## 1. Cloudflare
1. Zona `skedulei.com.br` no plano Free, nameservers trocados no Registro.br, zona **Active**.
2. SSL/TLS → **Full (strict)**; Edge Certificates → **Always Use HTTPS**.
3. Os registros da Vercel entram no passo 5.

## 2. Supabase
1. Projeto na região **South America (São Paulo)**. Guarde a senha do banco.
2. **Connect** (topo do painel) → copie duas strings:
   - **Transaction pooler** (porta 6543): `DATABASE_URL` da API na Vercel.
   - **Session pooler** (porta 5432): migrations no GitHub Actions (a conexão direta é só IPv6).
3. Database → Extensions → habilite **pg_cron** e **pg_net**.

## 3. Migrations (GitHub Actions)
1. GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**: `SUPABASE_MIGRATIONS_URL` = string do Session pooler.
2. Actions → **Migrations** → Run workflow (ou faça push na `main`).
3. Confira no Supabase (Table Editor) as tabelas `skedulei_*` e o aviso de RLS ligado.

## 4. Vercel
Importe o repositório **duas vezes** (Add New → Project), uma por app. A Vercel precisa ter acesso à org TagenTech no GitHub.

**skedulei-api**
- Root Directory: `apps/api` · Framework Preset: **Other** (o resto vem do `apps/api/vercel.json`).
- Environment Variables: as da seção "API" do [.env.vercel.example](../.env.vercel.example). Gere os segredos como em [LANCAMENTO.md](LANCAMENTO.md#1-chaves-e-segredos); `CRON_SECRET` com `openssl rand -base64 48`.
- Depois do deploy: `https://<skedulei-api>.vercel.app/v1/health` deve responder `{"status":"ok"}`.

**skedulei-web**
- Root Directory: `apps/web` · Framework Preset: **Next.js**.
- Environment Variables: `API_URL=https://<skedulei-api>.vercel.app`.

## 5. Domínio
1. skedulei-web → Settings → Domains → adicione `skedulei.com.br` e `www.skedulei.com.br` (www redireciona para o domínio raiz).
2. No Cloudflare → DNS, crie o que a Vercel mostrar, com proxy **desligado (DNS only, nuvem cinza)**. Normalmente:
   - `A` `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
3. Espere a Vercel marcar os dois como **Valid Configuration**.

## 6. Jobs agendados (pg_cron)
0. Na API (Vercel): `SCHEDULER_ENABLED=false` e `CRON_SECRET` (32+ caracteres; `openssl rand -base64 48`).
1. Supabase → Database → Extensions: habilite `pg_cron` e `pg_net`. Depois SQL Editor → cole [deploy/supabase/cron.sql](../deploy/supabase/cron.sql): guarde o segredo no Vault (`vault.create_secret`, o mesmo valor do `CRON_SECRET`), troque `API_URL` e rode.
2. Depois de 1–2 minutos, no SQL Editor:
   ```sql
   select status_code, content, created from net._http_response order by created desc limit 5;
   ```
   Esperado: `200` com `{"checked":…,"sent":{"H24":…,"H2":…}}`. `401` = segredo diferente; `404` = URL errada ou `CRON_SECRET` não configurado na API.

## 7. Conferência final
- `https://skedulei.com.br` abre, cadastro e login funcionam, `https://skedulei.com.br/api/v1/health` responde.
- Faça login e confira o IP gravado: `select ip, created_at from skedulei_security_events order by created_at desc limit 5;`. Se aparecer um IP da Vercel em vez do seu, ajuste `TRUST_PROXY_HOPS` na skedulei-api (o rate-limit de login depende disso).
- E-mail (Resend) e OAuth: siga [LANCAMENTO.md](LANCAMENTO.md), usando `https://skedulei.com.br` nas URLs de callback e criando os registros DNS do Resend no Cloudflare.
