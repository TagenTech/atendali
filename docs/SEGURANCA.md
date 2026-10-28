# Análise de segurança — OWASP

> **Histórico:** o conteúdo abaixo da seção "Auditoria de lançamento — Agendei" é da análise original do Turmei (23/10/2026,
> professor/aluno). As proteções que vieram junto (cifra de CPF, 2FA, sessões, CSP com nonce, SSRF, CSV, open redirect)
> continuam valendo e têm testes; os termos "professor" e "aluno" lá equivalem a "conta" e "cliente/paciente" aqui.

## Auditoria de lançamento — Agendei (28/10/2026)

**Escopo:** API NestJS, web Next.js, `packages/contracts`, scripts, dependências e configuração de deploy, no estado
anterior ao primeiro push. **Referências:** OWASP Top 10 (2021) e OWASP API Security Top 10 (2023).
**Método:** leitura do código dos pontos de risco (autenticação, OAuth, páginas públicas, multiempresa/RLS, upload,
financeiro), `pnpm audit`, varredura de segredos no que iria para o git, testes automatizados para cada correção
(unidade + e2e com Postgres real + Playwright). **Não foi feito:** teste de invasão dinâmico (ZAP), revisão jurídica,
teste em Supabase real (só Postgres local) — itens em [LANCAMENTO.md](LANCAMENTO.md).

### Resultado

| | |
|---|---|
| Vulnerabilidades em dependências (`pnpm audit --prod`) | **0** |
| Segredos no repositório (chaves privadas, tokens de nuvem/Resend/GitHub) | **nenhum** (`.env*` reais são ignorados pelo git) |
| Achados corrigidos nesta auditoria | **4** (1 alto, 3 médios/baixos) — abaixo |
| Achados em aberto que dependem de decisão/infra | **3** (1 crítico em serverless) — abaixo |

### Corrigidos

| # | OWASP | Achado | Sev. | Correção e teste |
|---|---|---|---|---|
| A1 | A07 · A04 | **Sequestro prévio de conta no login social.** `createFromProvider` marcava o e-mail como confirmado mesmo quando o provedor não o garante (Microsoft). Um atacante podia criar a conta com o e-mail da vítima via Microsoft (ou por cadastro com senha, sem confirmar) e, quando a vítima entrasse depois pelo Google, a conta era ligada **mantendo a senha e o login Microsoft do atacante** | Alta | Conta criada por provedor que não garante o e-mail nasce **não confirmada**; ao ligar uma conta não confirmada, **senha, logins sociais e sessões anteriores são apagados**. 2 testes novos em `auth.service.spec.ts` |
| A2 | A04 · API6 | **Reserva online sem teto por pessoa.** Sem login, quem quisesse ocupava a agenda inteira (10 reservas/h por IP, mas IPs rotativos) | Média | Cada telefone mantém no máximo **3 horários futuros** pela página pública (`ONLINE_BOOKING.maxActivePerClient`); mensagem amigável; teste e2e novo |
| A3 | A07 | **Senhas comuns aceitas** (`12345678`, `password123`, sequências) apesar do mínimo de 8 caracteres | Média | `isCommonPassword`/`passwordProblem` em `contracts` + validação `NotCommonPassword` na API (cadastro, redefinição e troca) e nas 3 telas; testes de unidade, API e Playwright (`senhas.spec.ts`) |
| A4 | A05 | **Scripts de demonstração** (`seed-demo*.js`, senha pública `senha-forte-123`) podiam ser apontados para um banco/API de produção | Baixa | `demo-guard.js`: recusam qualquer destino fora de `localhost` e `NODE_ENV=production` (override só com `ALLOW_DEMO_SEED=1` em homologação) |

Também nesta rodada (UX com efeito de segurança): erros de formulário agora aparecem **embaixo do campo** com foco no
primeiro inválido (antes alguns botões ignoravam o clique em silêncio), "As senhas precisam ser iguais" aparece junto
dos demais erros no cadastro e a troca de senha exige a senha atual na validação do formulário.

### Em aberto (decisão ou infraestrutura)

| # | OWASP | Achado | Sev. | O que fazer |
|---|---|---|---|---|
| P1 | A07 · API4 | **Limites de tentativa na memória do processo.** O `ThrottlerModule` e o bloqueio por e-mail (`LoginAttempts`) não são compartilhados entre instâncias. Com uma instância (VPS/Docker) está ok; em **Vercel serverless** a proteção contra força bruta quase não funciona | **Crítica se serverless** | Opção A: 1 instância. Opção B: storage compartilhado (Redis/Postgres) + regras de rate limit no Cloudflare. Ver [LANCAMENTO.md §4](LANCAMENTO.md#4-limite-de-tentativas-e-bloqueio-de-login) |
| P2 | A09 | **Sem trilha de auditoria financeira por negócio.** Estorno, sangria, fechamento de caixa, desconto e pagamento de comissão não deixam registro de *quem* fez | Média | Tabela `audit_log` no mesmo `TenantDb` + tela de atividade (proposta em [LANCAMENTO.md §6](LANCAMENTO.md#6-recomendações-de-segurança-pós-lançamento-imediato)) |
| P3 | A04 | **Sem captcha** na página pública, no cadastro e no contato | Média | Cloudflare Turnstile |

### Situação por categoria (Agendei)

| OWASP | Estado | Evidência |
|---|---|---|
| **A01** Controle de acesso | ✅ | JWT em toda rota (pública só com `@Public()`); `OrgGuard` exige cadastro ativo no negócio + permissão por rota; **RLS no Postgres** (`TenantInterceptor` + papel `agendei_tenant`) além do filtro `organization_id` em toda consulta; profissional só mexe na própria agenda; testes e2e de isolamento (`organizations`, `agenda`, `finance`, `retention`, `branding`) |
| **A02** Criptografia | ✅ | bcrypt custo 12; refresh token opaco só como SHA-256, rotativo, com detecção de reuso; tokens de e-mail e de reserva só como hash; CPF, observações de saúde e segredo do 2FA em **AES-256-GCM** (`DATA_ENCRYPTION_KEY` fora do banco); HSTS; cookie `httpOnly`/`Secure`/`SameSite=Lax` |
| **A03** Injeção | ✅ | TypeORM parametrizado (SQL manual só em DDL fixo e `DELETE … $1`); `ValidationPipe({ whitelist: true })` em todos os DTOs; React escapa; e-mail com `escapeHtml`; CSV neutraliza `= + - @`; imagens: só PNG/JPG/WebP **conferidos pelos bytes** (SVG recusado), servidas com `nosniff` |
| **A04** Design inseguro | ⚠️ | limites por rota; teto de reservas por telefone (A2); gift card com 12 caracteres sorteados por `crypto.randomInt`; cadastro revela "já existe conta" por decisão consciente (limitado a 10/h); sem captcha (P3) |
| **A05** Configuração | ✅ | sem `NODE_ENV` a API assume produção (sem Swagger nem rotas de dev); CSP `default-src 'none'` na API e **nonce + strict-dynamic** no web; HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; corpo JSON limitado a 1 MB; CORS só para origens listadas; segredos de exemplo recusados |
| **A06** Componentes vulneráveis | ✅ | `pnpm audit` limpo; Dependabot + CodeQL + audit no CI |
| **A07** Autenticação | ⚠️ | 5 senhas erradas/e-mail → bloqueio de 15 min; 2FA TOTP opcional com códigos de recuperação; sessões revogáveis; OAuth com `state` e PKCE; sequestro prévio corrigido (A1); senhas comuns recusadas (A3); limites em memória (P1) |
| **A08** Integridade | ✅ | migrations versionadas, CI com build e testes, lockfile; sem desserialização insegura |
| **A09** Logs e monitoramento | ⚠️ | trilha de segurança (login, senha, 2FA, sessões, equipe) com IP mascarado; Sentry opcional sem dados pessoais; falta auditoria financeira (P2) |
| **A10** SSRF | ✅ | o servidor só chama provedores OAuth fixos e endpoints de push em allowlist HTTPS; nenhuma URL de usuário é buscada |

### Comandos úteis

```bash
pnpm audit --prod                 # dependências
pnpm verify                       # tipos, lint, regras, API e2e, build e Playwright
pnpm --filter @agendei/api test:e2e -- agenda     # inclui o teto de reservas por telefone
```

---


**Data:** 23/10/2026 · **Escopo:** monorepo completo (API NestJS, web Next.js, contratos, Docker/Caddy, dependências)
**Referências:** OWASP Top 10 (2021) e OWASP API Security Top 10 (2023)
**Método:** revisão manual do código, auditoria de dependências (`pnpm audit`), checagem do que iria para o git,
testes automatizados de cada correção (unidade + e2e contra Postgres real) e verificação em modo produção.

## Resumo

| | Antes | Depois |
|---|---|---|
| Vulnerabilidades em dependências (`pnpm audit`) | **77** (6 críticas, 36 altas) | **0** |
| Achados no código | 10 (2 altos, 5 médios, 3 baixos) | **todos corrigidos** |
| Recomendações (CPF, CSP, 2FA, sessões, logs, HTTPS, backups, CI) | 9 pendentes | **todas implementadas** (2ª rodada, abaixo) |
| Segredos que iriam para o repositório | nenhum | nenhum |
| Testes de segurança automatizados | — | anti-SSRF, open redirect, CSV injection, bloqueio de login, isolamento entre contas, cabeçalhos, 2FA (vetores RFC 6238), revogação de sessão, CPF cifrado no banco, exclusão de conta |

**Pronto para o primeiro push.** `.env`, `.env.local`, `.env.prod` e `backups/` são ignorados pelo git; os
arquivos `.example` só têm valores de exemplo. **Nunca** faça commit de um `.env` real — se acontecer, troque
todos os segredos (JWT, VAPID, OAuth, Resend, senha do banco), não basta apagar o arquivo.

---

## Achados e correções

| # | OWASP | Achado | Sev. | Correção |
|---|---|---|---|---|
| 1 | A06 | Dependências vulneráveis: Next.js 16.2.4 (inclui **bypass do `proxy.ts`** e DoS), `tar` via bcrypt 5 (críticas), multer/qs/lodash/js-yaml via NestJS 10 | Crítica | Next 16.4.3, bcrypt 6, NestJS 11 (Express 5), `overrides` para `qs` e `js-yaml` → **0 vulnerabilidades** |
| 2 | A10 SSRF · API7 | O endereço de push vem do navegador e o servidor faz POST para ele → podia mirar rede interna/metadados da nuvem (`169.254.169.254`) | Alta | Só HTTPS em serviços oficiais de push (Google, Mozilla, Apple, Microsoft), checado no cadastro **e** no envio; timeout de 10 s (`lembretes/push-endpoint.ts`) |
| 3 | A05 | Sem `NODE_ENV`, a API assumia *development*: Swagger aberto, caixa de saída com **links de troca de senha** pública e `synchronize` no banco | Alta | Padrão agora é **produção**; recursos de dev só com `NODE_ENV=development\|test` explícito |
| 4 | A09 | Sem `RESEND_API_KEY`, o link de redefinição de senha ia para o log — também em produção | Média | Link só aparece em dev; em produção, erro sem o token. E-mails mascarados nos logs |
| 5 | A03 | **CSV injection**: nome de aluno como `=HYPERLINK(...)` virava fórmula no Excel | Média | Células que começam com `= + - @` recebem `'` na frente |
| 6 | A03 | Nome do usuário entrava sem escape no HTML dos e-mails (HTML injection) | Média | `escapeHtml` em todo texto vindo do usuário |
| 7 | A01 | **Open redirect**: `/login?next=/\evil.com` passava na checagem | Média | `safeNext` valida pela origem resolvida; testes com `//`, `/\`, `javascript:` |
| 8 | A04 | `?erro=` exibia qualquer texto na tela de login (link de phishing com mensagem falsa) | Média | Só códigos fixos (`cancelado`, `falhou`, `vincular`…) viram mensagem |
| 9 | A07 | Limite de login só por IP: ataque distribuído contra um mesmo e-mail não era contido | Média | 5 senhas erradas por e-mail em 15 min → bloqueio de 15 min (429) + log |
| 10 | A05 | API sem CSP; web sem HSTS; `X-Powered-By: Next.js`; export CSV sem limite próprio; aba do WhatsApp com `window.opener` | Baixa | CSP `default-src 'none'` na API, HSTS no web e na API, `poweredByHeader: false`, 10 exportações/min, `opener = null`, segredos de exemplo recusados |

### 2ª rodada — recomendações implementadas

| # | OWASP | Antes | Agora |
|---|---|---|---|
| 11 | A02 | CPF em texto puro no banco | **AES-256-GCM** na aplicação (`common/crypto/field-crypto.ts`), chave `DATA_ENCRYPTION_KEY` fora do banco (chaves derivadas por HKDF); índice cego HMAC para checar duplicidade e cópia mascarada para exibição. Migration cifra os CPFs existentes (ida e volta testadas sem perda) |
| 12 | A05 | CSP do web com `'unsafe-inline'` em scripts | **Nonce por requisição** + `'strict-dynamic'` no `proxy.ts`; nenhum script inline sem nonce executa |
| 13 | A07 | Sem segundo fator | **2FA opcional (TOTP, RFC 6238)** com app autenticador + 10 códigos de recuperação de uso único; anti-replay do mesmo código; vale também para login social |
| 14 | A07 | Access token valia até 15 min após trocar senha/sair | **Revogação imediata**: `tokensValidAfter` no professor + sessões encerradas checadas no guard |
| 15 | A07 | Sem controle de aparelhos | Tela **Mais → Segurança da conta**: aparelhos conectados, encerrar um ou todos os outros, trocar senha |
| 16 | A09 | Só log no console | **Trilha de auditoria** (`security_events`, 365 dias): logins, falhas, bloqueios, 2FA, senha, sessões, exclusão — com IP mascarado. Visível ao professor em "Atividade recente". **Sentry** opcional (`SENTRY_DSN`) com remoção de dados pessoais |
| 17 | LGPD | Exclusão de conta manual | **Excluir minha conta** no app (pede senha ou código 2FA), apaga todos os dados e invalida tokens na hora |
| 18 | Infra | HTTP puro; backups sem criptografia | **Caddy** com HTTPS automático (Let's Encrypt) no `docker-compose.prod.yml`; backups cifrados (`.dump.enc`, AES-256 + PBKDF2, `BACKUP_PASSPHRASE`) — restauração testada |
| 19 | A06 | Sem automação | **CI** (GitHub Actions: typecheck, lint, testes, e2e, build, `pnpm audit --prod --audit-level high`), **CodeQL**, **Dependabot** e `SECURITY.md` |

---

## Situação por categoria (OWASP Top 10 2021)

### A01 — Controle de acesso ✅
- Toda rota é autenticada por padrão (guard global); rotas públicas são explícitas (`@Public()`): login, cadastro,
  OAuth, feed `.ics` (token secreto de 192 bits), saúde.
- **Isolamento entre professores**: toda consulta filtra pelo `userId` do JWT, nunca por parâmetro do cliente.
  Teste e2e prova que outra conta recebe 404 em aluno e cobrança alheios.
- Referências cruzadas validadas (crédito de reposição pertence ao aluno e ao professor; cobrança avulsa só para aluno próprio).

### A02 — Falhas criptográficas ✅
- Senhas com **bcrypt (custo 12)**; comparação com hash falso quando o e-mail não existe (tempo constante).
- Access token JWT de 15 min **só em memória** no navegador; refresh token opaco de 384 bits, guardado só como
  **SHA-256**, rotativo, com detecção de reuso (derruba todas as sessões).
- Tokens de e-mail (confirmação/senha) de 256 bits, hash no banco, uso único, expiram (3 dias / 1 hora).
- `JWT_SECRET` obrigatório com ≥ 32 caracteres; valores de exemplo recusados.
- **CPF cifrado em repouso** (AES-256-GCM, chave fora do banco); segredo do 2FA também cifrado. Guarde a
  `DATA_ENCRYPTION_KEY` num cofre — **perdê-la torna os CPFs ilegíveis**; vazá-la exige rotação.

### A03 — Injeção ✅
- SQL: TypeORM com parâmetros em tudo (inclusive nas poucas consultas SQL manuais).
- XSS: React escapa por padrão; o único `dangerouslySetInnerHTML` é um script fixo de tema.
  URLs de chamada só `http(s)`. E-mails com escape. CSV com neutralização de fórmulas. `.ics` com escape RFC 5545.

### A04 — Design inseguro ✅ (decisões conscientes)
- O cadastro informa "esse e-mail já tem conta" (troca consciente: usabilidade > enumeração), com limite de 10/hora por IP
  e aviso por e-mail ao dono. "Esqueci a senha" **não** revela contas.
- Login social só une contas existentes quando o provedor garante o e-mail (Google, Meta); Microsoft nunca une por e-mail.

### A05 — Configuração ✅
- Produção por padrão; Swagger e rotas de dev desligados. Helmet na API (CSP, HSTS, nosniff, frame-ancestors none).
- Web: CSP, HSTS, `X-Frame-Options: DENY`, `Permissions-Policy`, `Referrer-Policy`, sem `X-Powered-By`.
- Erros sem stack trace para o cliente. CORS fechado (mesma origem via proxy).
- CSP do web com **nonce por requisição** e `'strict-dynamic'` (estilos ainda com `'unsafe-inline'`, risco baixo).

### A06 — Componentes vulneráveis ✅
- `pnpm audit`: **0** vulnerabilidades. Lockfile versionado.
- Dependabot semanal, CodeQL e `pnpm audit --prod --audit-level high` no CI.

### A07 — Autenticação ✅
- Limites: login 5/min por IP **+** bloqueio por e-mail; cadastro 10/h; esqueci-senha 5/h; refresh 30/min.
- OAuth 2.0 com `state` (anti-CSRF) e **PKCE** (Google/Microsoft); cookie temporário `httpOnly` de 10 min.
- Cookie de sessão `httpOnly`, `Secure` (produção), `SameSite=Lax`. Trocar senha encerra todas as sessões.
- JWT fixado em HS256; tokens de 2FA com finalidade própria não servem como sessão.
- Trocar senha, sair, encerrar aparelho ou excluir conta **invalida o access token na hora**.
- 2FA opcional (TOTP + códigos de recuperação); tela de aparelhos conectados.

### A08 — Integridade ✅
- Sem desserialização insegura; service worker sempre sem cache (`no-store`).
- Futuro (cobrança): webhooks do gateway com **verificação de assinatura** e idempotência (ver MONETIZACAO.md).

### A09 — Logs e monitoramento ✅
- Logs de segurança (`[Security]`): bloqueio de login, reuso de refresh token, conta social criada/vinculada,
  senha redefinida — com e-mail mascarado.
- Trilha de auditoria no banco por 365 dias (tabela `security_events`), visível ao professor.
- Erros 5xx para o Sentry quando `SENTRY_DSN` está definido (sem e-mail, IP ou cookies).
- ⚠️ Configure alertas no Sentry (picos de 5xx) ao publicar.

### A10 — SSRF ✅
- Push restrito aos serviços oficiais (ver achado 2). OAuth e Resend usam URLs fixas no código.

---

## OWASP API Security Top 10 (2023)

| Risco | Situação |
|---|---|
| API1 BOLA (acesso a objeto de outro) | ✅ filtro por `userId` em todas as consultas + teste e2e |
| API2 Autenticação quebrada | ✅ ver A07 |
| API3 Propriedade exposta / mass assignment | ✅ DTOs com `whitelist` (campos extras descartados); CPF e hash de senha nunca saem |
| API4 Consumo de recursos | ✅ limites globais (300/min) e por rota; períodos limitados (agenda 62 dias, relatórios 2 anos); corpo JSON até 100 KB. ⚠️ atividade (50) e créditos (200) com teto; listas de alunos/cobranças sem paginação — ok na escala de um professor |
| API5 Autorização por função | ✅ papel único (professor); rotas de dev só em dev |
| API6 Fluxos de negócio sensíveis | ✅ pagamento não ultrapassa o saldo; cobrança com pagamento não é cancelada/apagada; crédito de reposição não é usado duas vezes (lock) |
| API7 SSRF | ✅ corrigido |
| API8 Configuração | ✅ ver A05 |
| API9 Inventário | ✅ Swagger só em dev; `/v1` versionado |
| API10 Consumo inseguro de APIs | ✅ respostas de OAuth/Resend validadas, timeouts de 10 s |

---

## Infraestrutura (Docker / Caddy)
- ✅ Containers rodando como usuário `node` (não root); Postgres **sem porta exposta**; só o Caddy publica 80/443.
- ✅ Migrations na subida; `synchronize` desligado em produção.
- ✅ **HTTPS automático** pelo Caddy (defina `DOMAIN`). Com Cloudflare na frente, use `TRUST_PROXY_HOPS=2`.
- ✅ Backups diários **cifrados** (`BACKUP_PASSPHRASE`). ⚠️ Ainda copie-os para fora do servidor e teste a restauração.
- ⚠️ Segredos em `.env.prod` no servidor: permissões `600`, nunca no git; idealmente um cofre (Doppler, 1Password, Vault).

## Riscos restantes (prioridade)

1. **Ao publicar:** `.env.prod` com segredos fortes (`openssl rand -base64 32` para `DATA_ENCRYPTION_KEY`), `DOMAIN`,
   Resend configurado, cópia dos backups fora do servidor, alertas no Sentry.
2. **Antes de cobrar:** termos/privacidade revisados (LGPD), webhooks do gateway assinados e idempotentes, DPA com o gateway.
3. **Contínuo:** aceitar PRs do Dependabot, restauração de backup trimestral, pentest externo antes de escalar.

## Como verificar
```bash
pnpm audit                                   # dependências
pnpm test                                    # inclui anti-SSRF, open redirect, bloqueio de login
pnpm --filter @agendei/api test:e2e          # isolamento, CSV, cabeçalhos, 2FA, revogação, CPF cifrado
```
