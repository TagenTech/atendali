# Skedulei — agendamento e gestão para negócios com hora marcada

Web app (PWA instalável, mobile-first **e** com layout próprio para desktop) para salões, barbearias, clínicas de
estética, clínicas médicas, odontologia e terapias. Um núcleo comum (agenda, equipe, serviços, financeiro) com
**módulos por segmento** (comissão, estoque, pacotes, anamnese, prontuário, convênios…).
Nasceu do monorepo do [Turmei](../gestao-aulas) (mesma stack e convenções).

Documentos: [Plano de produto e arquitetura](docs/PLANO.md) · [Autenticação](docs/AUTENTICACAO.md) · [Segurança](docs/SEGURANCA.md) · [Lançamento: o que falta](docs/LANCAMENTO.md) · [Lacunas e andamento](docs/LACUNAS.md)

## O que já tem

| Área | Recursos |
|---|---|
| **Conta** | Cadastro por e-mail (confirmação, recuperação de senha), login social (Google/Microsoft/Meta), 2FA, sessões por aparelho, exportação e exclusão (LGPD) |
| **Multiempresa** | A mesma conta pode estar em vários negócios, com um perfil em cada; seletor de negócio; todo dado de negócio filtrado por `organizationId` |
| **Perfis de acesso** | Dono, Gerente, Recepção, Profissional e Financeiro com permissões em `packages/contracts/src/access.ts` (a mesma tabela decide a API e o que o web mostra) |
| **Onboarding** | 6 passos: segmento → dados do negócio → horário de funcionamento → serviços-modelo do segmento → equipe → módulos |
| **Equipe** | Convite por e-mail (link de 7 dias, só a conta do e-mail convidado aceita), pessoa "sem acesso" que só aparece na agenda, cor na agenda, o negócio nunca fica sem dono |
| **Serviços** | Catálogo por categoria, duração, preço, agendamento online, desativar/reativar; vocabulário do segmento ("Procedimentos", "Pacientes") |
| **Negócio** | Dados, CNPJ/CPF, unidades com endereço e horário (faixas por dia, intervalo de almoço), liga/desliga módulos |
| **Agenda** | Visões **Dia** (colunas por profissional; no celular um por vez) e **Semana** (7 dias do profissional), **arrastar e soltar** para remarcar e puxar a borda para mudar a duração (desktop), clicar no horário vazio para marcar, horários livres sugeridos, encaixe fora do horário, conflito barrado (409), status do dia (confirmado → chegou → atendimento → concluído / faltou / cancelado), remarcar, bloqueios (profissional ou unidade), confirmação pronta no WhatsApp |
| **Lista de espera** | Pedido por cliente com preferência de serviço, profissional e dia; quando um horário que combina é cancelado ou remarcado, aparece "Abriu vaga" com a mensagem pronta no WhatsApp e o botão Agendar já preenchido |
| **Horário por profissional** | Cada pessoa pode ter horário próprio (dentro do horário da unidade); vale para a agenda, sugestões e agendamento online |
| **Clientes** | Busca por nome/celular/e-mail, ficha com histórico, atendimentos, faltas, total gasto e última visita; observações cifradas; exclusão LGPD (anonimiza e mantém o histórico) |
| **Agendamento online** | Página pública `/<endereço-do-negócio>`: serviço → profissional (ou qualquer um) → dia → horário → nome e celular. Antecedência mínima 1h, até 60 dias; link "minha reserva" para ver/cancelar até 2h antes; comprovante por e-mail |
| **Caixa** | Abertura com troco, sangria e suprimento, fechamento com conferência (esperado por forma de pagamento × dinheiro contado na gaveta), histórico |
| **Comandas** | Abertas a partir do atendimento ("Abrir comanda", que marca "Chegou") ou avulsas; serviços e produtos/itens avulsos com profissional, desconto por item e na comanda, vários pagamentos (PIX, dinheiro com troco, crédito, débito…), fechar conclui o atendimento; cancelar/estornar com regras |
| **Formas de pagamento** | Liga/desliga, taxa % + fixa da maquininha e prazo de recebimento (D+N); a taxa fica gravada em cada pagamento |
| **Comissões** | % por profissional e % por serviço (o do serviço vence), sobre o valor bruto ou líquido das taxas; vales; fechamento que paga tudo em aberto; profissional vê só as próprias |
| **Financeiro** | Faturamento, taxas, líquido, comissões, ticket médio, por dia, por forma de pagamento, por profissional e mais vendidos, com períodos prontos |
| **Contas a pagar** | Aluguel, fornecedores, salários, impostos: categoria (plano de contas padrão por segmento, editável), vencimento, recorrência mensal (até 36), marcar como paga (data, forma, conta); status pendente/atrasada/paga calculado |
| **Contas a receber** | Cada pagamento de comanda gera um recebível líquido da taxa na data prevista (D+N da forma; PIX/dinheiro já nascem recebidos); baixa manual e lançamento de receita avulsa |
| **DRE e fluxo de caixa** | DRE gerencial (receita bruta → descontos → taxas → líquida → comissões → margem → despesas fixas por categoria → resultado); fluxo realizado e projetado em 30/60/90 dias, por dia ou semana |
| **Importar clientes** | CSV (nome, celular, e-mail, nascimento, etiquetas, observações) com pré-visualização linha a linha, deduplicação por celular no negócio e relatório |
| **Segurança de dados** | Além do filtro no código, **RLS no Postgres**: rotas de negócio rodam com papel restrito e só enxergam o negócio ativo |
| **Layout** | Celular: barra inferior e bottom sheets. Desktop (≥ 1024 px): barra lateral, tabelas e painel lateral à direita |

### Reserva online e relacionamento (o que o cliente vê)

| Área | Recursos |
|---|---|
| **Página pública** `/<slug>` | Logo, fundo, cor e frase do negócio; avaliações; escolha de **vários procedimentos** (até 5) **um logo após o outro** ou **cada um no seu horário**; reserva **para outra pessoa** (filho, mãe…) com responsável e parentesco; sem login |
| **Minha reserva** `/reserva/<link>` | Ver, **remarcar** e cancelar um procedimento ou tudo; confirmar presença; adicionar ao calendário (.ics); reservas guardadas neste aparelho |
| **Minhas reservas** `/<slug>/minhas-reservas` | Código de 6 dígitos no e-mail cadastrado no celular → ver, remarcar e cancelar a família toda |
| **Lembretes** | E-mail 24 h e 2 h antes com botão de confirmar/remarcar/cancelar; aviso à equipe a cada reserva online, remarcação e cancelamento; liga/desliga em Configurações |
| **Taxa de agendamento** | Opção visível e **desligada** ("Em breve"): depende do pagamento online (Fase 4) |

### Retenção, clínica, gestão e controle

| Área | Recursos |
|---|---|
| **Retenção (Fase 3)** | Estoque e ficha técnica, pacotes de sessões, clube (mensalidade), vale-presente, pontos de fidelidade, avaliações e painel de TV |
| **Módulo clínico** | Prontuário (evolução, prescrição, atestado), fichas de **anamnese** e **termos** com modelo editável, envio por link para o paciente preencher no celular ou preenchimento no balcão; tudo cifrado e com acesso registrado. Salas, equipamentos, fotos, teleconsulta e convênios aparecem como "Em breve" |
| **Relatórios** | Faltas, cancelamentos, ocupação da agenda, ticket médio, retorno de clientes, mais feitos e equipe; clientes sem voltar e aniversariantes com mensagem pronta no WhatsApp |
| **Atividade (auditoria)** | Quem estornou, deu desconto, desfez pagamento, mexeu no caixa, nas comissões e nas contas — só o dono vê; ninguém edita nem apaga |
| **Demo** | `node apps/api/scripts/seed-demo.js` cria um usuário por segmento (`demo-<segmento>@skedulei.test`, senha `senha-forte-123`) e `seed-demo-data.js` enche com ~30 dias de movimento — só em `localhost` |

**Próximo (Fase 4)**: pagamento online (sinal, link de pagamento, assinatura recorrente do clube), WhatsApp oficial, NFS-e. O que ainda falta para lançar e as lacunas conhecidas: [docs/LANCAMENTO.md](docs/LANCAMENTO.md) e [docs/LACUNAS.md](docs/LACUNAS.md).

## Estrutura

```
apps/api            NestJS 11 + TypeORM + Postgres   → http://localhost:3200/v1  (Swagger: /v1/api/docs, só fora de produção)
apps/web            Next.js 16 + Tailwind 4 (PWA)    → http://localhost:3201
packages/contracts  tipos e regras puras compartilhadas (perfis, segmentos, horário, slug, datas/fuso, dinheiro, telefone, CPF)
deploy/             Caddy/nginx de produção
scripts/backup.sh   dump diário do Postgres com retenção
```

O navegador fala só com o web; `/api/v1/*` vai para a API (rewrite do Next em dev, proxy em produção).
Assim o cookie de sessão é `httpOnly` + `SameSite=Lax` e não há CORS.
Rotas de negócio (`/v1/org/*`) exigem o header `x-organization-id` com um negócio em que a conta está ativa.

## Rodando local

Pré-requisitos: Node 22, pnpm 9 e Postgres (Postgres.app na 5432 ou `pnpm db:up` com Docker).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # JWT_SECRET, DATA_ENCRYPTION_KEY, DEV_USER_*
cp apps/web/.env.example apps/web/.env.local
createdb skedulei && createdb skedulei_test
pnpm --filter @skedulei/contracts build
pnpm dev
```

Contas: pelo app em `/cadastro` (e-mail) ou com Google/Microsoft/Meta (configure em [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md)).
Também dá para criar/trocar senha pela linha de comando: `pnpm api:create-user --name "Nome" --email voce@email.com --password "senha-forte"`.
Sem `RESEND_API_KEY`, os links de confirmação e de senha aparecem no log da API e em `http://localhost:3200/v1/dev/outbox`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Tudo em modo watch |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` | Build e qualidade |
| `pnpm verify` | **Tudo antes de encerrar uma mudança**: tipos, lint, regras, API e2e, build e Playwright (celular e desktop) |
| `pnpm test` | Testes de unidade (contracts + API) |
| `pnpm --filter @skedulei/api test:e2e` | API inteira contra Postgres real (banco `skedulei_test`): `organizations`, `agenda` (inclui agendamento online), `finance`, `ledger`, `retention` (estoque, pacotes, clube, vale, pontos, avaliações), `branding`, `responsavel-reservas` (responsável × paciente, Minhas reservas), `carrinho`, `clinico`, `lembretes`, `auditoria`, `relatorios`, `app` (login, cadastro, 2FA, exclusão de conta) e `conta` (sessões, senha, exportação) |
| `pnpm --filter @skedulei/web test:e2e` | Fluxos no navegador (Playwright, celular **e** desktop): cadastro e senhas, onboarding, agenda, agendamento online, carrinho, Minhas reservas, caixa, contas/DRE, fidelização, personalização, módulo clínico, lembretes, atividade, relatórios e a **regressão de telas** (toda tela abre limpa, sem erro de console, 5xx ou rolagem lateral, com cada perfil). Sobe API/web próprios nas portas 3210/3211 com o banco `skedulei_e2e_web` zerado. `E2E_SKIP_BUILD=1` reaproveita o último build. Primeira vez: `pnpm --filter @skedulei/web exec playwright install chromium` |
| `pnpm --filter @skedulei/web video` | Grava o vídeo do fluxo completo de uma clínica pediátrica (3 atos, com legendas) em `apps/web/videos/` |
| `pnpm --filter @skedulei/api migration:generate src/migrations/Nome` | Nova migration a partir das entidades (hoje há uma única migration inicial; gere contra um banco limpo e acrescente `lockdownSupabaseTables`) |

Em dev o schema sincroniza sozinho (`TYPEORM_SYNC=true`); em produção só por migrations, aplicadas na subida da API.

## Produção (Docker)

> Deploy em Cloudflare + Vercel + Supabase: **[docs/DEPLOY_VERCEL_SUPABASE.md](docs/DEPLOY_VERCEL_SUPABASE.md)**.

```bash
cp .env.prod.example .env.prod      # DOMAIN, senhas, JWT_SECRET, DATA_ENCRYPTION_KEY, BACKUP_PASSPHRASE
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml exec api node dist/scripts/create-user.js --name "Nome" --email voce@email.com --password "senha-forte"
```

Sobe Postgres, API, web, **Caddy com HTTPS automático** (80/443, certificado Let's Encrypt para `DOMAIN`) e um
backup diário **cifrado** em `./backups` (14 dias). Gere as chaves com `openssl rand -base64 32` e guarde
`DATA_ENCRYPTION_KEY` e `BACKUP_PASSPHRASE` num cofre: sem elas não há como ler CPFs nem restaurar backups.
Restaurar: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in arquivo.dump.enc -pass env:BACKUP_PASSPHRASE | pg_restore ...`.
Segurança: [docs/SEGURANCA.md](docs/SEGURANCA.md).
