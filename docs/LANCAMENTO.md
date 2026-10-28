# Lançamento — o que falta e como configurar

Atualizado em **28/10/2026**. Este é o checklist para colocar o Agendei no ar. Os itens marcados 🔴 **bloqueiam** o
lançamento; 🟡 são fortemente recomendados; 🟢 podem vir depois. A análise de segurança que originou a lista está em
[SEGURANCA.md](SEGURANCA.md#auditoria-de-lançamento--agendei-28102026).

Repositório: <https://github.com/TagenTech/skedulei> (ainda **sem push**; só há commits locais).

## Painel de pendências

| # | Item | Situação | Onde |
|---|---|---|---|
| 1 | 🔴 Segredos de produção | a gerar | [§1](#1-chaves-e-segredos) |
| 2 | 🔴 E-mail transacional (confirmação, **recuperação de senha**, convites) | a configurar | [§2](#2-e-mail-e-recuperação-de-senha) |
| 3 | 🔴 Login com Google, Microsoft (Outlook) e Meta | a configurar | [§3](#3-login-social) |
| 4 | 🔴 Limite de tentativas em ambiente com mais de uma instância | **decisão de infra** | [§4](#4-limite-de-tentativas-e-bloqueio-de-login) |
| 5 | 🔴 Banco: migrations + papel de RLS em produção | a validar em homologação | [§5](#5-banco-de-dados) |
| 6 | 🔴 Textos legais (termos, privacidade) para clínica/paciente e dado de saúde | revisão jurídica | [§7](#7-lgpd-e-textos-legais) |
| 7 | 🔴 Contato de segurança no `SECURITY.md` | a preencher | [§8](#8-operação) |
| 8 | 🟡 Trilha de auditoria financeira por negócio | a construir | [§6](#6-recomendações-de-segurança-pós-lançamento-imediato) |
| 9 | 🟡 Captcha (Cloudflare Turnstile) na página pública e no cadastro | a construir | [§6](#6-recomendações-de-segurança-pós-lançamento-imediato) |
| 10 | 🟡 Monitoramento (Sentry, uptime), backups e teste de restauração | a configurar | [§8](#8-operação) |
| 11 | 🟡 Teste de invasão leve (OWASP ZAP) em homologação | a fazer | [§6](#6-recomendações-de-segurança-pós-lançamento-imediato) |
| 12 | 🟢 Fase 4 do produto: cobrança/pagamento online, lembretes por WhatsApp, jobs agendados, recorrência do clube | roadmap | [PLANO.md](PLANO.md) |

> Não existe hoje **agendamento a partir de uma cobrança** (link de pagamento/sinal): depende do gateway de
> pagamento, que é da Fase 4. O agendamento online funciona sem pagamento.

---

## 1. Chaves e segredos

Gere **um valor diferente para cada ambiente** e guarde em cofre (nunca em git, chat ou print). Para trocar depois,
veja a coluna "Se vazar".

| Variável | Para quê | Gerar | Se vazar / perder |
|---|---|---|---|
| `JWT_SECRET` | assina o token de acesso | `openssl rand -base64 48` | trocar derruba todas as sessões (aceitável) |
| `DATA_ENCRYPTION_KEY` | cifra CPF, observações de saúde, segredo do 2FA | `openssl rand -base64 32` | **perder = dados cifrados ilegíveis**; vazar exige re-cifrar. Faça backup da chave separado do banco |
| `BACKUP_PASSPHRASE` | cifra os dumps | `openssl rand -base64 32` | sem ela o backup não restaura |
| `CRON_SECRET` | autentica os jobs agendados | `openssl rand -base64 48` | trocar no Supabase e na API ao mesmo tempo |
| `VAPID_*` | notificações push | `npx web-push generate-vapid-keys` | usuários precisam reativar o push |
| `RESEND_API_KEY` | e-mail | painel do Resend | revogar e criar outra |
| `*_CLIENT_SECRET` | login social | consoles dos provedores | gerar novo segredo |

Variáveis de operação: `NODE_ENV=production` (**sem ela a API já assume produção**), `PUBLIC_WEB_URL`,
`CORS_ORIGINS`, `TRUST_PROXY_HOPS` (1 atrás de Vercel/nginx; 2 com Cloudflare + proxy), `SIGNUP_ENABLED`,
`SENTRY_DSN`. Exemplos: [`.env.prod.example`](../.env.prod.example), [`.env.vercel.example`](../.env.vercel.example).

Confira antes de subir: `JWT_SECRET` com ≥ 32 caracteres e **diferente** dos exemplos (a API recusa os de exemplo).

## 2. E-mail e recuperação de senha

O fluxo já está pronto e testado (Playwright + API): "Esqueci minha senha" → link de 1 hora, uso único → nova senha com
confirmação → todas as sessões são encerradas. Em produção **ele só funciona com e-mail configurado**: sem
`RESEND_API_KEY` a API devolve erro (de propósito: o link nunca vai para o log).

1. Crie a conta no [Resend](https://resend.com) e **verifique o domínio** (registros DNS que ele mostra).
2. No DNS (Cloudflare) deixe: **SPF**, **DKIM** (os do Resend) e **DMARC** (`_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@seudominio`). Sem isso os e-mails caem no spam.
3. Variáveis: `RESEND_API_KEY` e `MAIL_FROM` (ex.: `Agendei <nao-responda@seudominio.com.br>`).
4. **Teste em homologação**: cadastre-se → chega o link de confirmação; "Esqueci minha senha" → chega o link; convide uma pessoa para a equipe → chega o convite; confirme que nenhum cai em spam.

E-mails enviados hoje: confirmação de cadastro, redefinição de senha, aviso de "já existe conta com seu e-mail",
convite de equipe e o link da reserva online (para ver, remarcar ou cancelar). Lembretes (véspera do atendimento) são da Fase 4.

## 3. Login social

Detalhes de cada console em [AUTENTICACAO.md](AUTENTICACAO.md#configurar-cada-provedor). Resumo do que fazer:

| Provedor | Onde criar | O que preencher | Redirect URI |
|---|---|---|---|
| **Google** | Cloud Console → Tela de consentimento + Credenciais | escopos `openid email profile`; **publicar o app** (em "teste" só e-mails cadastrados entram) | `https://SEU_DOMINIO/api/v1/auth/oauth/google/callback` |
| **Microsoft** (Outlook, Hotmail, Live, trabalho) | Entra ID → Registros de aplicativo | contas "em qualquer diretório e pessoais"; segredo do cliente — **anote a validade** (máx. 24 meses) e agende a renovação | `…/oauth/microsoft/callback` (plataforma *Web*) |
| **Meta** (Facebook) | developers.facebook.com | caso de uso "Login do Facebook"; permissões `email` e `public_profile`; modo **Ao vivo**; URL de privacidade `/privacidade`; **URL de instruções de exclusão de dados** (a Meta exige — pode apontar para a página de privacidade se ela explicar Mais → Segurança → Excluir conta) | `…/oauth/facebook/callback` |

Variáveis: `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`. Os botões só aparecem
quando o par do provedor está configurado (`GET /v1/auth/providers`).

Checklist de teste em homologação, **por provedor**: (a) criar conta nova; (b) entrar de novo (mesma identidade);
(c) com e-mail já cadastrado por senha, entrar pelo provedor e conferir que a conta foi ligada; (d) cancelar na tela do
provedor e ver a mensagem amigável no login; (e) conta com 2FA pede o código.

Regras de segurança já aplicadas (testadas):
- `state` + PKCE (Google, Microsoft); cookie do `state` `httpOnly`, 10 min.
- **Google e Meta** garantem o e-mail → ligam a uma conta existente. **Microsoft não garante** (contas corporativas
  podem declarar qualquer e-mail) → não liga a conta existente e **cria a conta com e-mail "não confirmado"**.
- **Sequestro prévio** (corrigido em 28/10): se alguém criou uma conta com o e-mail de outra pessoa e o dono real entra
  depois por um provedor que garante o e-mail, a conta passa ao dono e **senha, logins sociais e sessões antigas são
  apagados**.

## 4. Limite de tentativas e bloqueio de login

Hoje o limite de requisições por IP (`@nestjs/throttler`) e o **bloqueio por e-mail** (5 senhas erradas → 15 min) vivem
na **memória do processo**. Isso é suficiente para **uma única instância** (VPS/Docker com
[docker-compose.prod.yml](../docker-compose.prod.yml)). Em **Vercel serverless** (vários processos, reinícios a frio) os
contadores não são compartilhados e a proteção contra força bruta fica **muito enfraquecida**.

Decida antes de lançar:

- **Opção A — uma instância (mais simples):** hospede a API em VPS/Docker (ou um serviço com 1 réplica). Mantém tudo como está.
- **Opção B — serverless:** antes do lançamento, (1) trocar o `ThrottlerModule` para um *storage* compartilhado (Redis/Upstash) e o
  `LoginAttempts` (`apps/api/src/auth/login-guard.ts`) por uma tabela no Postgres ou Redis; (2) criar **regras de
  Rate Limiting no Cloudflare** para `/api/v1/auth/*` (login, cadastro, esqueci-senha), `/api/v1/public/*/bookings` e
  `/api/v1/contact`.

Em qualquer opção, ative no Cloudflare: *Bot Fight Mode* e a regra gerenciada OWASP (WAF).

## 5. Banco de dados

- Tabelas com prefixo `agendei_`; produção usa **migrations** (`apps/api/src/migrations`), nunca `synchronize`. O workflow
  [migrate.yml](../.github/workflows/migrate.yml) roda a cada push na `main` com o secret `SUPABASE_MIGRATIONS_URL` (Session pooler).
- **Isolamento entre negócios** depende de RLS + papel `agendei_tenant`. Valide em **homologação no Supabase** (ainda não
  testado fora do Postgres local): a API usa `SET LOCAL ROLE` dentro de transação; confirme que funciona pelo
  *Transaction pooler* (porta 6543) e que `agendei_tenant` existe e tem `GRANT` nas tabelas. Teste: usuário do negócio A
  recebe 404 em dados do negócio B (há testes e2e: `organizations.e2e-spec.ts`, `agenda.e2e-spec.ts`).
- `lockdownSupabaseTables` desliga o acesso `anon`/`authenticated` da API REST do Supabase — confira no painel que as
  tabelas aparecem com RLS ligado e **sem políticas públicas**.
- Os scripts `seed-demo*.js` **recusam** rodar fora de `localhost` (e com `NODE_ENV=production`); os usuários demo têm
  senha pública e **não podem existir em produção**.

## 6. Recomendações de segurança (pós-lançamento imediato)

1. **Trilha de auditoria financeira por negócio** (🟡). Hoje eventos de segurança cobrem login, senha, 2FA, sessões e
   equipe (convite/perfil/remoção), mas **não** estorno de comanda, sangria, fechamento de caixa, desconto, pagamento de
   comissão nem exclusão de conta a pagar. Proposta: tabela `audit_log` (`organization_id`, `member_id`, `action`,
   `entity`, `entity_id`, `meta`, `created_at`) gravada na mesma transação (`TenantDb`), entra no RLS sozinha, tela
   "Atividade" para Dono/Gerente.
2. **Captcha** (🟡) — Cloudflare Turnstile (grátis) em `/<slug>` (confirmar agendamento), `/cadastro` e `/contato`. Hoje a
   página pública tem limite de 10 reservas/hora por IP e **3 horários futuros por telefone**, mas IPs rotativos ainda
   conseguem encher horários com telefones diferentes.
3. **Confirmação de e-mail** não é exigida para usar o app; considere exigir antes de convidar equipe ou publicar a página.
4. **2FA obrigatório** para Dono/Gerente (hoje é opcional).
5. **DAST**: rode o OWASP ZAP (baseline) contra homologação e corrija o que aparecer.
6. **Revisão de dependências** automática: Dependabot e CodeQL já estão no repositório; `pnpm audit` está limpo (0).

## 7. LGPD e textos legais

O Agendei trata **dado de saúde** (LGPD art. 11) em nome das clínicas. Antes de lançar, com apoio jurídico:

- Reescrever **Termos** e **Política de Privacidade** (`/termos`, `/privacidade`) para o modelo real: a **clínica é a controladora**
  dos dados dos pacientes e o Agendei é **operador**; prever contrato de tratamento de dados (DPA) para as clínicas.
- Base legal e consentimento para dado de saúde; prazo de retenção; canal do titular e **encarregado (DPO)**.
- Telas já existentes que ajudam: excluir/anonimizar cliente (histórico permanece sem identificação), excluir minha conta,
  observações de saúde cifradas, CPF cifrado e nunca devolvido inteiro ao navegador.
- Plano de resposta a incidentes (quem avisa a ANPD e os titulares em até 3 dias úteis).

## 8. Operação

- **Contato de segurança**: edite [SECURITY.md](../SECURITY.md) com um e-mail real (hoje diz "e-mail do mantenedor").
- **Monitoramento**: `SENTRY_DSN` (dados pessoais são removidos antes do envio); health check `GET /v1/health`; alerta de uptime.
- **Backups**: Supabase (diário) + dumps cifrados (`BACKUP_PASSPHRASE`); **faça um teste de restauração** antes do lançamento e a cada trimestre.
- **CI**: `.github/workflows/ci.yml` (tipos, lint, testes, build, `pnpm audit`), `codeql.yml`, `migrate.yml`. Habilite *branch protection* na `main` exigindo o CI verde.
- **Antes de cada versão**: `pnpm verify` (tipos, lint, regras, API e2e, build, Playwright). Vídeo de demonstração: `pnpm --filter @agendei/web video`.
- **Renovações**: segredo do cliente Microsoft, certificados (Cloudflare/Let's Encrypt automático), chaves VAPID.
