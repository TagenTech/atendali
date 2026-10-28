# Skedulei — guia rápido para agentes

Monorepo pnpm + Turbo, nascido do Turmei (`../gestao-aulas`). Leia o [README](README.md) e o [docs/PLANO.md](docs/PLANO.md) (produto, roadmap por fases).

## Convenções
- Textos de interface e mensagens de erro em **português (pt-BR)**, tom acolhedor e curto.
- **Dinheiro em centavos** (int). **Datas de calendário** como `'YYYY-MM-DD'`; instantes em UTC; "hoje" no fuso da **unidade** (`todayIn(tz)` em `packages/contracts/src/dates.ts`).
- **Regras puras** (perfis/permissões, segmentos, horário de funcionamento, slug; depois disponibilidade, comissão, DRE) ficam em `packages/contracts` com testes — API e web usam as mesmas. Depois de mudar contracts: `pnpm --filter @skedulei/contracts build`.
- Status derivados (atrasado, pago…) são **calculados**, nunca gravados.

## Multiempresa e permissões
- Conta (`users`) ≠ negócio (`organizations`). A ligação é `members` (perfil por negócio; pode existir sem conta: `SEM_ACESSO`).
- Toda tabela de negócio tem `organization_id` e **toda consulta filtra por `org.organizationId`** — nunca confie em id vindo do corpo/URL sem esse filtro.
- Rotas de negócio: `@OrgRoute(Permission.X)` + `@CurrentOrg() org` (`apps/api/src/organizations/org-context.ts`). O `OrgGuard` global lê o header `x-organization-id`, exige cadastro ATIVO e as permissões. Rotas são protegidas por padrão (JWT); pública só com `@Public()`.
- Perfis e permissões: `ROLE_PERMISSIONS`/`canAssignRole` em `packages/contracts/src/access.ts`. No web, esconda o que a pessoa não pode com `useOrg().can(...)` — a API também recusa.
- Módulos por segmento: `SEGMENT_PRESETS`/`FEATURES` em `packages/contracts/src/segments.ts`; no web `useOrg().has(feature)` e `useOrg().vocab` ("Serviço" × "Procedimento", "Cliente" × "Paciente"). Nunca escreva "cliente"/"serviço" fixo onde o vocabulário muda.
- Isolamento entre negócios tem teste e2e (`apps/api/test/organizations.e2e-spec.ts`, `agenda.e2e-spec.ts`). Recurso novo de negócio → teste de que outro negócio não lê nem altera.
- **RLS no Postgres** (`apps/api/src/tenancy`): em rota @OrgRoute o `TenantInterceptor` abre uma transação com `app.org_id` e `SET LOCAL ROLE skedulei_tenant`; as políticas só deixam ler/gravar linhas do negócio ativo. Nos serviços de negócio use `TenantDb.repo(Entidade)` / `TenantDb.transaction(...)` (nunca `@InjectRepository`), senão a consulta sai da transação e perde a proteção. Tabela nova com `organization_id` entra nas políticas sozinha (na subida da API). Rotas públicas/sistema (login, onboarding, `/public/*`) não têm RLS: filtre pelo negócio no código.

## Agenda (Fase 1)
- Regras puras em `packages/contracts/src/agenda.ts`: `availableSlots`, `withinBusinessHours`, `STATUS_FLOW`/`canMoveTo`, `occupiesSlot` (cancelado libera), `ONLINE_BOOKING`.
- Conflito de horário: sempre `SchedulingService.assertFree` dentro da transação (trava a linha do profissional; dois cliques simultâneos → o segundo recebe 409).
- Profissional sem `AGENDA_VIEW_ALL` só vê/mexe na própria coluna (`onlyMine`/`assertCanWrite` em `appointments.service.ts`).
- Horário efetivo de quem atende = `effectiveHours(unidade, member.workingHours)` (interseção). Use sempre ele, nunca só o da unidade.
- Agenda de vários dias: `GET /org/agenda?date=&days=1..7`. A grade (`components/agenda/day-grid.tsx`) recebe colunas genéricas (profissional × dia) e faz arrastar/redimensionar só com mouse.
- Lista de espera: cancelar ou remarcar chama `WaitlistService.onSlotFreed` na mesma transação (interno e pelo link público).
- Agendamento online: `/v1/public/*` (sem login), página `/<slug>` e "minha reserva" `/reserva/<token>` (token só como hash no banco). Cliente casado pelo telefone dentro do negócio.
- Observações do cliente podem ter dado de saúde: cifradas (`notes_encrypted`). Excluir cliente = anonimizar (histórico fica).

## Financeiro (Fase 2)
- Regras puras em `packages/contracts/src/finance.ts`: `orderTotals` (desconto da comanda repartido com `allocate`, sem perder centavo), `paymentFee`, `commissionRate`/`commissionsFor`, `cashExpected`. Percentuais em **bps** (100 = 1%).
- Receber exige caixa aberto da unidade; pagamento nunca maior que o que falta (troco é só na tela). Fechar a comanda gera `commission_entries` e conclui os agendamentos ligados.
- Estorno só com o caixa do pagamento ainda aberto e sem comissão já paga. Fechar o caixa exige não ter comanda aberta com pagamento nele.
- Comissões: quem tem `FINANCE_VIEW` vê todas; quem só tem `COMMISSIONS_OWN` vê as próprias (checado no serviço, a rota é `@OrgRoute()`).
- Excluir alguém da equipe com histórico (agenda, comanda, comissão, caixa) arquiva em vez de apagar.

## Retenção e estoque (Fase 3)
- Tudo passa pela comanda: `OrderExtrasService` (`apps/api/src/financeiro/order-extras.service.ts`) valida cada tipo de item (`PRODUTO`, `PACOTE`, `CLUBE`, `VALE`, `SESSAO_PACOTE`, `SESSAO_CLUBE`), aplica efeitos no fechamento (`onClose`) e desfaz no estorno (`onReverse`). Estorno recusa o que não dá para desfazer com segurança (pacote já usado, vale já usado).
- Módulos por `Feature` (ESTOQUE, PACOTES, ASSINATURAS, VALES, FIDELIDADE): `assertFeature` na API, `has()` + nav `features` no web. Avaliações e painel de TV não têm módulo.
- Vale-presente: venda não é receita; `VALE_PRESENTE` como pagamento é (sem taxa/ledger, fora da config de formas). Sessão de pacote/clube tem valor 0; comissão usa `refValueCents`.
- Pontos: `loyalty_entries`; resgate fica na comanda (`pointsRedeemed`) e o desconto entra em `totalDiscountCents`.
- Avaliação pública por token (só o hash no banco); painel `/tv` mostra só primeiro nome + inicial.
- `supertest`: não use `await` dentro da cadeia `http.post(...).send(...)` — calcule antes.

## Personalização e demo
- Página pública: logo e fundo em `organization_images` (bytea; o navegador reduz antes de enviar; a API confere os bytes — PNG/JPG/WebP, nunca SVG), cor da paleta `BRAND_COLORS` e frase. Endereços `/public/orgs/<slug>/brand/{logo,cover}?v=` (cache longo, versão = data da troca).
- Limites de cadastro/criação de negócio (10/h por IP) vêm de `REGISTER_THROTTLE_LIMIT` e o de reservas pela página pública (10/h por IP) de `PUBLIC_BOOKING_THROTTLE_LIMIT` (o Playwright usa 1000 nos dois).
- `node apps/api/scripts/seed-demo.js` cria um usuário demo por segmento (`demo-<segmento>@skedulei.test`, senha `senha-forte-123`), com todos os módulos ligados. Só dev. `node apps/api/scripts/seed-demo-data.js` enche essas contas com ~30 dias de movimento (equipe, clientes, agenda, caixa, comandas, comissões, contas, estoque, pacotes, clube, vale, pontos, avaliações); só roda em negócio sem comandas.
- **Regressão**: `pnpm verify` (tipos, lint, regras, API e2e, build, Playwright). `apps/web/e2e/regressao-telas.spec.ts` abre toda tela como dono e como cada perfil (recepção, profissional, financeiro, gerente), no celular e no desktop, e falha com erro de console, resposta 5xx ou rolagem lateral. Mudou tela, rota ou permissão → rode antes de encerrar.

- **Formulários**: erro embaixo do campo (`useFieldErrors`, `lib/use-field-errors.ts`; chave = `id` do campo) ou zod + react-hook-form nas telas de conta; nunca só `toast.error` para campo vazio. Senha: `passwordProblem`/`isCommonPassword` (`contracts/src/password.ts`) — tela e API (`NotCommonPassword`) recusam senhas comuns. Testes: `e2e/senhas.spec.ts`, `e2e/formularios-erros.spec.ts`.
- **Tema**: abre **claro** por padrão (`lib/theme.ts`); escuro/automático só se a pessoa escolher (`e2e/tema.spec.ts`).
- **Vídeo do fluxo completo** (clínica pediátrica: cadastro, agenda pela recepção, paciente pelo celular, comanda, caixa, comissão, financeiro): `pnpm --filter @skedulei/web video` (`E2E_SKIP_BUILD=1` reaproveita o build) → `apps/web/videos/` (3 atos em .webm + `pediatria-completo.mp4` com ffmpeg). Roteiro em `apps/web/e2e-video/`, fora do `verify`.

## Contas, DRE e fluxo (fim da Fase 2)
- Regras puras em `packages/contracts/src/ledger.ts` (`payableStatus`/`receivableStatus`, `monthlyDates`, `settlementDate`, `buildDre`, `buildCashFlow`, plano de contas `defaultChartOfAccounts`) e `csv.ts` (`parseCsv`, `csvSafe`/`toCsv` neutralizam fórmula, `previewClientImport`).
- API em `apps/api/src/financeiro` (`ledger.service`, `reports.service`, `ledger.controller`; rotas `org/finance/{payables,receivables,categories,accounts,dre,cashflow}`). Ver: `FINANCE_VIEW`; mexer: `FINANCE_MANAGE`.
- Todo pagamento de comanda cria um `Receivable` (líquido da taxa; data = pagamento + D+N; D+0 já nasce recebido); some junto com o pagamento estornado. Pagamentos anteriores à fase não têm recebível (sem backfill).
- Plano de contas e conta "Conta principal" nascem na primeira consulta do negócio (`LedgerService.seed`, com advisory lock).
- DRE: receitas/comissões pelas comandas pagas no período, receita avulsa pela data recebida, despesas pela data paga. Fluxo realizado inclui fechamentos de comissão como saída; projetado não inclui comissões em aberto.
- Importação de clientes: `POST org/clients/import/preview` e `/import` (`CLIENTS_MANAGE`); o servidor sempre revalida; corpo JSON até 1 MB. Web: `/financeiro/{contas,dre,fluxo}`, `/clientes/importar`.

## Herdado do Turmei
- Autenticação: e-mail/senha + Google/Microsoft/Meta (OAuth no servidor, `src/auth/oauth.service.ts`). Ver `docs/AUTENTICACAO.md`.
  Em dev sem `RESEND_API_KEY`, links de e-mail (confirmação, senha, **convites**) ficam em `GET /v1/dev/outbox`.
- CPF é dado pessoal: cifrado no banco (AES-256-GCM), nunca volta inteiro para o navegador (`cpfMasked`).
- Telefone: sempre via `normalizePhone`/`isValidPhone`/`whatsappLink`/`dialNumber` (`packages/contracts/src/phone.ts`). Colunas `varchar(16)`.
- Módulos da API se falam por eventos (`src/common/events.ts`, `@nestjs/event-emitter`) para evitar dependência circular.
- Dev usa `synchronize`; produção usa migrations (`src/migrations`). Mudou entidade → gere migration. Migrations que criam tabelas devem chamar `lockdownSupabaseTables(queryRunner)` (`src/database/supabase-lockdown.ts`).

## Segurança (ver docs/SEGURANCA.md e docs/LANCAMENTO.md)
- Login social: provedor que **não garante o e-mail** (Microsoft) cria conta *não confirmada* e nunca liga a conta existente; ao ligar uma conta não confirmada por provedor que garante, apague senha, identidades e sessões (`signInWithProvider`). Não afrouxe.
- Reserva pública: `ONLINE_BOOKING.maxActivePerPhone` (5 horários futuros por telefone, a família toda) no `BookingService.book`.
- **Responsável × paciente**: o telefone é de quem marca; o **paciente pode ser outra pessoa** (`patientName`, `relationship`). Vários clientes dividem o mesmo telefone (irmãos): identifique por telefone **+ nome** (`samePerson`/`personKey` em `contracts/src/guardian.ts`), nunca só pelo telefone. Importação CSV também deduplica por telefone + nome. `Client.guardianName/guardianRelationship`; a ficha traz `relatives` (mesmo telefone).
- **Minhas reservas** (`PortalService`, rotas `public/orgs/:slug/my-bookings/*`): código de 6 dígitos (HMAC, 10 min, 5 tentativas, 5 pedidos/h) enviado **só ao e-mail já cadastrado no telefone**; resposta idêntica com ou sem cadastro; sessão assinada de 60 min (`Authorization: Bearer`, escopo = negócio + telefone). Cancelar/remarcar valem a mesma antecedência (`canClientCancel`, 2 h) e só alcançam pacientes do telefone da sessão. Em dev o código aparece em `/v1/dev/outbox` (`code`). O canal por WhatsApp/SMS entra na Fase 4 (`PortalService.requestCode` é o ponto de troca).
- **Carrinho** (vários procedimentos numa reserva, até `ONLINE_BOOKING.maxItemsPerBooking` = 5): `POST public/orgs/:slug/bookings/group` grava tudo ou nada numa transação; itens de um grupo compartilham `bookingGroupId` e **um link** (`groupTokenHash`; com um item só vale o fluxo antigo, `manageTokenHash`). `GET public/orgs/:slug/slots/sequence` devolve os encaixes "um logo após o outro" (`planSequences` em contracts; grade de 5 min, e o servidor aceita grade de 5 min nos itens do grupo). Itens não podem se sobrepor (`anyOverlap`) e o teto por telefone conta cada item. Link: `GET bookings/:token/group`, `…/group/cancel` (sem `itemId` cancela tudo), `…/group/reschedule` (`itemId` obrigatório se houver mais de um). Web: `components/public/cart-flow.tsx` + `patient-form.tsx`; a reserva (`/reserva/<token>`) sempre lê o endpoint de grupo.
- **Auditoria** (`apps/api/src/auditoria`, tela `/atividade`, só o **dono**: `Permission.AUDIT_VIEW`): `AuditService.log(em, org, {...})` grava na **mesma transação** da ação (estorno/cancelamento, desconto, item e pagamento removidos, abrir/movimentar/fechar caixa, vale e fechamento de comissão, contas a pagar/receber, exclusão de cliente). Ação sensível nova do dinheiro → chame `audit.log` dentro do `tenant.transaction`. O texto do registro **nunca leva dado pessoal** (ex.: exclusão de cliente não guarda o nome). Ninguém edita nem apaga estes registros.
- **Relatórios** (`apps/api/src/relatorios`, tela `/relatorios`, `Permission.REPORTS_VIEW`): regras puras em `contracts/src/reports.ts` (`buildOverview`, `workingMinutes`, `upcomingBirthdays`); faltas = faltas ÷ (concluídos + faltas); ocupação = horas marcadas (não canceladas) ÷ horas de trabalho (`effectiveHours`); "sem voltar" ignora quem já tem horário futuro; mensagens de WhatsApp prontas (`comebackMessage`, `birthdayMessage`).
- **Lembretes** (`apps/api/src/lembretes`): `RemindersService.run()` manda e-mail 24 h e 2 h antes (regra pura `dueReminder` em contracts: janela, uma vez, não lembra quem marcou há < 1 h) para quem tem e-mail, se `Organization.remindersEnabled`. Roda a cada 5 min (`@Cron`, desligado com `SCHEDULER_ENABLED=false`) ou por `POST /v1/internal/jobs/reminders` com `x-cron-secret` = `CRON_SECRET` (32+ caracteres; sem segredo a rota dá 404) — em produção serverless use `deploy/supabase/cron.sql`. Cada envio "reserva" a vez antes (`reminded_24_at`/`reminded_2_at`, `UPDATE … WHERE … IS NULL`), então dois servidores não repetem. O link do lembrete é **assinado** (`agenda/reminder-link.ts`, `r.<corpo>.<mac>`, vale até 24 h depois do horário) e funciona no lugar do código da reserva em `/reserva/<link>` e nos endpoints de grupo (só aquele agendamento); `POST …/group/confirm` confirma presença. Reserva online nova/remarcada/cancelada pelo cliente emite `Events.BOOKING_*` e avisa por e-mail o profissional (ou o dono, se ele não tiver e-mail).
- **Módulo clínico** (`apps/api/src/clinico`, só com os módulos ANAMNESE/TERMOS/PRONTUARIO ligados): prontuário (`clinical_records`), modelos (`document_templates`) e documentos do paciente (`patient_documents`, com **cópia** das perguntas/texto no envio). Tudo é dado de saúde: conteúdo/respostas cifrados (`encryptField`); ler e escrever exige `Permission.CLINICAL_RECORDS` (dono e profissional — gerente e recepção **não** leem); recepção só envia link. Abrir prontuário/documento, criar e apagar anotação geram `SecurityEvent` (`RECORD_*`, `DOCUMENT_*`). Anotação só pode ser apagada pelo autor em até 24 h. Link do paciente: `/documento/<token>` (hash no banco, 7 dias, uso único; termo guarda nome digitado + IP). Módulos **sem tela** (`COMING_SOON_FEATURES`: SALAS, EQUIPAMENTOS, FOTOS, TELECONSULTA, CONVENIOS) ficam "Em breve" e `normalizeFeatures` os descarta — ao construir um, tire-o da lista.
- No web, rotas `/public/*` nunca renovam sessão nem deslogam (401 delas é do próprio fluxo); `api()` aceita `portalToken`.
- Senha: `passwordProblem`/`isCommonPassword` (contracts) na tela **e** `NotCommonPassword` nos DTOs.
- `seed-demo*.js` só rodam em `localhost` (`scripts/demo-guard.js`).
- Limites de tentativa e bloqueio de login são **em memória**: só valem com 1 instância (ver LANCAMENTO.md §4).
- Sem `NODE_ENV` a API assume **produção** (sem Swagger/rotas de dev). Dev usa `NODE_ENV=development` no `.env`.
- URLs que o servidor chama precisam de allowlist (evitar SSRF).
- Texto do usuário em HTML de e-mail → `escapeHtml`; em CSV → neutralizar `= + - @`; redirects → `safeNext`.
- Mensagens vindas da URL (`?erro=`) só por código fixo, nunca texto livre.
- Dado pessoal sensível (inclui **dado de saúde**, LGPD art. 11) → `encryptField`/`blindIndex` (`common/crypto/field-crypto.ts`), coluna `select: false`.
- Ações de segurança e de equipe → `SecurityEventsService.record`; invalidar sessões → `SessionRevocationService`.
- Script inline no web precisa do nonce (`x-nonce` em `headers()`); a CSP vem do `proxy.ts`.

## Web
- Next.js 16 (`proxy.ts` no lugar de middleware; rotas protegidas listadas lá). Consulte `node_modules/next/dist/docs/` antes de usar APIs novas.
- Layout: **celular** = barra inferior + bottom sheet; **desktop (`lg`, ≥ 1024 px)** = `Sidebar` + tabelas + o mesmo `Sheet` vira painel lateral (`useIsDesktop`). Toda tela nova precisa das duas composições; confira em 375 px e 1024 px.
- Negócio ativo: `useOrg()` (`src/lib/org.tsx`); queries do negócio em `src/lib/queries/org.ts`, com o id do negócio na chave (`orgKeys`).
- Tokens de cor em `src/app/globals.css` (claro/escuro, cores da equipe `--pro-1…8`). Não use `dark:` do Tailwind: o tema manual usa `data-theme`.
- Valores do navegador (data/hora, localStorage, media query) via `useSyncExternalStore` (`useHydrated`, `useIsDesktop`) — o lint proíbe `setState` em effect.
- Rotas dinâmicas novas exigem reiniciar o `next dev`.

## Verificação
`pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @skedulei/api test:e2e && pnpm build && pnpm --filter @skedulei/web test:e2e`

Testes: regras em `packages/contracts/*.spec.ts`; API em `src/**/*.spec.ts` (unidade) e `test/*.e2e-spec.ts` (Postgres real, setup em `test/env.ts`/`helpers.ts`); web em `apps/web/e2e` (Playwright, projetos `celular` e `desktop`, seletores por rótulo/papel acessível). Funcionalidade nova → teste junto.
