# Plataforma de Agendamento Multissetor — Plano de Produto e Arquitetura

> SaaS de agendamento e gestão para **negócios de serviço com hora marcada**: salões de beleza, barbearias, clínicas de estética, clínicas médicas, consultórios (odonto, fisio, psico, nutri), spas e studios.
> **Web responsivo + PWA instalável** (como o Turmei em `../gestao-aulas`), com **experiência de desktop de verdade** (agenda multiprofissional, tabelas, atalhos) e **mobile-first** para o profissional na rua e para o cliente final.
> Nome provisório: **Skedulei** (alternativas: Horaí, Marquei, Encaixe).

Status (28/10/2026): **Fases 0 a 3 implementadas**, mais partes da 1 e da 5 que antecipamos por necessidade de lançamento: reserva online completa (carrinho de procedimentos, responsável × paciente, Minhas reservas por código no e-mail, remarcar), **lembretes por e-mail** 24 h/2 h com confirmação de presença e avisos à equipe, **módulo clínico mínimo** (prontuário, anamnese, termo), **relatórios** de gestão, **trilha de auditoria** do dinheiro e **personalização** da página pública. Ficam para a **Fase 4**: pagamento online (sinal/taxa de agendamento, link de pagamento, assinatura recorrente do clube), WhatsApp oficial (lembretes e confirmação por resposta, OTP), NFS-e, conciliação. Para a **Fase 5**: assinatura digital (ICP-Brasil), fotos antes/depois, convênios/TISS, teleconsulta, salas e equipamentos. Lacunas e prioridades: [LACUNAS.md](LACUNAS.md); o que falta para lançar: [LANCAMENTO.md](LANCAMENTO.md). Como rodar: [README](../README.md).

---

## 0. Resumo em uma página

| Pergunta | Resposta |
|---|---|
| **Para quem** | Dono do negócio, recepção, profissionais e o **cliente final** (que agenda sozinho). |
| **Diferencial** | Um núcleo único de agenda + financeiro, com **pacotes por segmento** que ligam o que cada setor precisa (prontuário, anamnese, comissão, estoque, convênio) sem poluir a tela dos outros. |
| **Concorrentes de referência** | Beleza: Trinks, Avec (ex-Beauty Date), Booksy, Fresha. Saúde: Feegow (Doctoralia), iClinic, Amplimed, Clinicorp. |
| **Como ganhar deles** | (1) UX muito mais rápida no desktop da recepção, (2) financeiro sério (DRE, fluxo de caixa, comissão, conciliação) que salão pequeno não tem, (3) WhatsApp como canal principal, (4) preço justo por profissional. |
| **Stack** | A mesma do Turmei: pnpm + Turbo, NestJS + TypeORM + Postgres, Next.js 16 + Tailwind 4 + Radix, TanStack Query. Acrescenta: TanStack Table, dnd-kit, cmdk, ECharts/Recharts, pg-boss (filas). |
| **MVP (fase 1)** | Agenda multiprofissional, serviços, clientes, agendamento online público, lembretes WhatsApp, caixa e comissão, relatórios básicos. |

---

## 1. Lições das referências de mercado

| Referência | O que copiar | O que evitar |
|---|---|---|
| **Fresha** | Sinal/depósito no agendamento, taxa de no-show em % do valor, bloqueio de quem falta repetidamente no agendamento online, agendamento "inteligente" que preenche buracos. | Cobrança por transação escondida; app do cliente que vira marketplace e "rouba" o cliente do salão. |
| **Booksy** | App separado para cliente e para profissional; **"Cliente confiável"** que dispensa sinal; avaliações pós-atendimento; automações de marketing. | Plano cobrado por membro que fica caro rápido. |
| **Trinks / Avec** | Comissão de profissional, controle de estoque/produtos, fechamento de caixa, pacotes e fidelidade, presença forte no Brasil (PIX, WhatsApp). | Interfaces densas e lentas no desktop, curva de aprendizado alta. |
| **Feegow / iClinic** | Prontuário customizável (modelo inicial segundo CFM), teleconsulta gravada com consentimento, faturamento TISS em lotes, controle de glosa, repasse médico. | Complexidade de convênio para quem só atende particular — deve ser **opcional**. |
| **Turmei (nosso)** | Cobrança com 1 toque pelo WhatsApp, status calculado (nunca gravado), centavos, `todayIn(timezone)`, CPF cifrado, push, `.ics`, PWA, tom acolhedor. | — |

---

## 2. Conceito central: núcleo + pacotes por segmento

Todo negócio de hora marcada tem as mesmas peças. O que muda é o vocabulário e alguns módulos.

```
Organização (conta SaaS, CNPJ/CPF)
 └── Unidade (filial: endereço, fuso, horário de funcionamento)
      ├── Recursos agendáveis
      │    ├── Profissional (pessoa)      ← tem agenda, serviços que faz, comissão
      │    ├── Sala / Cadeira / Maca       ← opcional (estética, odonto)
      │    └── Equipamento (laser, criolipólise) ← opcional, conflito de uso
      ├── Serviços (duração, preço, preparo/intervalo, recursos exigidos)
      ├── Clientes / Pacientes
      └── Agendamentos  →  Atendimento  →  Comanda/Venda  →  Pagamentos
```

### Pacotes por segmento (ligados na criação da conta, alteráveis depois)

| Módulo | Salão / Barbearia | Estética | Clínica médica / Saúde |
|---|:-:|:-:|:-:|
| Agenda, clientes, serviços, financeiro | ✅ | ✅ | ✅ |
| Vocabulário | Cliente, Serviço | Cliente, Procedimento | Paciente, Consulta |
| Comissão por profissional | ✅ | ✅ | Repasse médico |
| Estoque / venda de produtos | ✅ | ✅ (insumos por procedimento) | Opcional |
| Pacotes de sessões | ✅ | ✅ (ex.: 10 sessões de laser) | Fisio/psico |
| Assinatura/clube (ex.: barba ilimitada) | ✅ | ✅ | — |
| Ficha de anamnese | Opcional (química) | ✅ | ✅ |
| Fotos antes/depois | — | ✅ | Dermato/odonto |
| Termo de consentimento assinado | — | ✅ | ✅ |
| Prontuário eletrônico (evolução, CID, prescrição) | — | Opcional | ✅ |
| Teleconsulta | — | — | ✅ |
| Convênios + TISS | — | — | ✅ (fase 5) |
| Odontograma | — | — | Odonto (fase 6) |

Implementação (feita na Fase 0): `SEGMENT_PRESETS` e `FEATURES` em `packages/contracts/src/segments.ts` (módulos, vocabulário, serviços-modelo por segmento); `features` gravado no negócio. A UI esconde o que não está ligado; quando os módulos existirem, a API recusa rotas de módulos desligados.

---

## 3. Perfis de acesso (RBAC)

| Papel | O que vê / faz |
|---|---|
| **Dono** | Tudo, incluindo assinatura do SaaS, relatórios financeiros completos e auditoria. |
| **Gerente** | Tudo da unidade dele, menos assinatura e exclusão da conta. |
| **Recepção** | Agenda de todos, clientes, comanda, caixa. **Não** vê prontuário nem DRE. |
| **Profissional** | A própria agenda, os próprios clientes, as próprias comissões. Prontuário só dos seus pacientes (saúde). |
| **Financeiro** | Contas a pagar/receber, conciliação, relatórios. Sem prontuário. |
| **Cliente final** | Portal sem senha (link mágico/OTP por WhatsApp ou e-mail): agendar, remarcar, cancelar, pagar sinal, ver pacotes, assinar termos. |

Implementado na Fase 0: tabela `ROLE_PERMISSIONS` em `packages/contracts/src/access.ts` (a mesma decide API e web). Permissões granulares editáveis pelo dono (ex.: "pode dar desconto acima de 10%", "pode estornar") ficam para depois.

---

## 4. Funcionalidades completas por módulo

### 4.1 Agenda (coração do produto)
- Visões **Dia / Semana / Mês / Lista** e **visão por recurso** (colunas por profissional, sala ou equipamento) — principal tela da recepção no desktop.
- **Arrastar e soltar** para mover/remarcar; arrastar a borda para mudar duração; clique em espaço vazio cria agendamento.
- Agendamento com **vários serviços em sequência** (ex.: corte + escova + unha, com profissionais diferentes) e **serviços simultâneos**.
- **Conflitos**: profissional, sala e equipamento ao mesmo tempo; tempo de preparo/limpeza entre atendimentos (buffer).
- Horário de trabalho por profissional e por dia, intervalos, **bloqueios** (folga, férias, feriado), escala por unidade.
- **Recorrência** (toda terça 10h; sessões semanais de fisio) gerando ocorrências — mesma regra do Turmei.
- **Lista de espera** com aviso automático quando abre vaga.
- **Encaixe** e overbooking controlado (permitido só para papéis autorizados).
- Status do agendamento: agendado → confirmado → chegou (check-in) → em atendimento → concluído / faltou / cancelado (pelo cliente ou pelo negócio) / remarcado.
- Cores por profissional, por status ou por serviço; filtro rápido.
- **Sala de espera** (fila de check-in) e painel de chamada para TV da recepção (fase 3).
- Sincronização com Google Calendar/iCloud via `.ics` (leitura) e, depois, Google Calendar API (bidirecional) para o profissional.

### 4.2 Agendamento online (cliente final)
- **Página pública** do negócio (`skedulei.app/nome-do-salao`): fotos, endereço, serviços com preço, profissionais, avaliações, botão "Agendar".
- Fluxo em 4 passos: serviço → profissional (ou "qualquer um") → data/hora → identificação (nome + WhatsApp com OTP).
- Regras: antecedência mínima/máxima, intervalo de grade (15/30 min), serviços que só a recepção agenda, limite de agendamentos por cliente.
- **Sinal/pré-pagamento** por PIX ou cartão (opcional por serviço), **política de cancelamento** com prazo e taxa, **cliente confiável** dispensado de sinal, bloqueio automático após N faltas.
- Widget para incorporar no site, botão para Instagram (link na bio) e Google (Reserve with Google — fase 4).
- Remarcar/cancelar pelo link recebido, sem login.
- Página em PWA: o cliente pode "instalar" o salão no celular.

### 4.3 Clientes / Pacientes (CRM)
- Cadastro: nome, WhatsApp, e-mail, CPF (cifrado como no Turmei), data de nascimento, gênero, endereço, como conheceu, tags, observações, preferências (profissional favorito, bebida, alergias).
- Responsável legal (menores).
- **Linha do tempo** do cliente: agendamentos, comandas, pagamentos, pacotes, mensagens, anamneses, fotos, prontuário (conforme permissão).
- Indicadores por cliente: frequência média, ticket médio, LTV, última visita, **dias sem voltar**, faltas, saldo devedor, créditos.
- Segmentação: "não volta há 60 dias", "aniversariantes do mês", "fez coloração há 45 dias" (retorno sugerido por serviço).
- Importação de planilha (CSV/XLSX) dos sistemas concorrentes — essencial para migração.
- Mesclar duplicados.
- LGPD: consentimento de marketing separado, exportar dados do titular, anonimizar.

### 4.4 Serviços, pacotes e assinaturas
- Serviço: nome, categoria, duração, preço (fixo, "a partir de", por profissional), buffer, recursos exigidos, comissão padrão, insumos consumidos, retorno sugerido (dias), visível online ou não.
- Variações (cabelo curto/médio/longo com preço/duração diferentes).
- **Pacote de sessões**: N sessões com validade, saldo consumido a cada atendimento, venda parcelada.
- **Combo** (corte + barba com preço fechado).
- **Assinatura/clube** recorrente (ex.: R$ 99/mês, cortes ilimitados ou 4 por mês) com cobrança automática no cartão/PIX automático.
- Vale-presente (gift card) com código.
- Programa de fidelidade (pontos ou "a cada 10, ganhe 1") — fase 3.

### 4.5 Atendimento, comanda e PDV
- **Comanda** aberta no check-in: serviços executados (por profissional), produtos vendidos, descontos, gorjeta.
- Fechamento com **múltiplas formas de pagamento** na mesma conta (PIX + cartão + dinheiro), pagamento parcial, fiado (conta do cliente), uso de crédito/pacote/vale.
- Taxas por forma de pagamento (maquininha: débito, crédito à vista, parcelado) para calcular o **líquido** real.
- Recibo por WhatsApp/e-mail/PDF; **NFS-e** (ver 4.10).
- Estornos e cancelamentos com motivo e trilha de auditoria.

### 4.6 Financeiro (onde queremos ser melhores que a concorrência)
**Caixa**
- Abertura e fechamento de caixa por operador/unidade, sangria e suprimento, conferência (esperado × contado) por forma de pagamento.

**Contas a receber / pagar**
- Recebíveis por forma e data de liquidação (cartão D+1/D+30, parcelado), antecipação.
- Contas a pagar: aluguel, fornecedores, salários, impostos; recorrentes; anexos (boleto/nota); status calculado (pendente/pago/atrasado), como no Turmei.
- **Plano de contas** padrão por segmento (editável) e **centros de custo** (unidade, profissional).
- Contas bancárias/carteiras e transferências entre elas.

**Comissões e repasses**
- Regras: % por serviço, % por profissional, valor fixo, escalonada por meta, sobre bruto ou líquido (descontando taxa do cartão e insumos), comissão de venda de produto, comissão de assistente.
- Vales/adiantamentos descontados no fechamento.
- **Fechamento de comissão** por período com extrato que o profissional vê e "aceita".
- Profissional parceiro (Lei do Salão-Parceiro, Lei 13.352/2016): cota-parte do salão × do profissional, contrato e relatório próprio.
- Repasse médico (saúde): por procedimento, por convênio, por produção.
- Split automático de pagamento online (Asaas: split por `walletId` no recebimento) — fase 4.

**Conciliação**
- Importação de extrato OFX/CSV e conciliação sugerida; webhooks do gateway marcam pagamentos automaticamente.

**Cobrança de clientes**
- Link de pagamento PIX/cartão, cobrança de saldo devedor pelo WhatsApp com 1 toque (reaproveitar o padrão do Turmei), régua de cobrança automática para assinaturas/pacotes.

### 4.7 Relatórios e dashboards
Todos com filtros por **período, unidade, profissional, serviço, categoria, forma de pagamento, origem do cliente**, comparação com período anterior, **filtros salvos** (como no Turmei) e exportação CSV/XLSX/PDF.

| Grupo | Relatórios |
|---|---|
| **Painel do dono** (home do desktop) | Faturamento do dia/mês, previsto × realizado, ocupação da agenda, ticket médio, novos clientes, no-shows, saldo de caixa, contas a pagar da semana, metas. |
| **Financeiro** | **DRE gerencial** (receita bruta → deduções/taxas → receita líquida → custos variáveis: comissões e insumos → margem de contribuição → despesas fixas → resultado), **fluxo de caixa** realizado e projetado (30/60/90 dias), contas a pagar/receber, recebíveis de cartão, despesas por categoria, faturamento por forma de pagamento, inadimplência. |
| **Comercial** | Faturamento por serviço/categoria/profissional, serviços mais vendidos, venda de produtos, pacotes vendidos × consumidos (receita diferida), assinaturas ativas/MRR/churn. |
| **Agenda** | Taxa de ocupação por profissional e horário (mapa de calor dia × hora), no-show e cancelamento (por cliente, serviço, canal), antecedência média de agendamento, agendamentos por canal (online, WhatsApp, recepção). |
| **Clientes** | Novos × recorrentes, retenção por coorte, tempo médio entre visitas, clientes em risco (sem voltar), LTV, origem/canal de aquisição, aniversariantes, NPS. |
| **Equipe** | Produção por profissional, comissões a pagar, metas × realizado, ranking, tempo médio de atendimento. |
| **Estoque** | Posição, curva ABC, giro, produtos abaixo do mínimo, consumo de insumos por procedimento, custo por atendimento. |
| **Saúde** (quando ligado) | Atendimentos por convênio, glosas, repasse médico, produtividade por CID/procedimento. |

### 4.8 Comunicação e marketing
- **WhatsApp** em dois níveis:
  1. *Fase 1:* mensagens prontas abertas no WhatsApp do aparelho (`wa.me`), sem custo — padrão do Turmei.
  2. *Fase 2:* **WhatsApp Business Platform (Cloud API oficial)** para envios automáticos: confirmação ("responda 1 para confirmar"), lembrete 24h/2h antes, pós-atendimento, avaliação, aniversário, retorno sugerido. Templates aprovados pela Meta; custo por conversa repassado no plano.
- E-mail (Resend) e push (Web Push/VAPID, já pronto no Turmei).
- **Confirmação inteligente**: resposta do cliente atualiza o status na agenda.
- Campanhas segmentadas (clientes sumidos, aniversariantes) com limite de frequência e opt-out (LGPD).
- **Avaliações** pós-atendimento (nota + comentário), publicadas na página pública com moderação.
- Cupons e promoções (horários vazios com desconto — "happy hour").

### 4.9 Estoque
- Produtos de venda e de consumo interno (insumos), fornecedores, entrada por nota/manual, saída por venda ou baixa automática pelo procedimento (ficha técnica: "botox consome 50 U"), inventário, lote e validade (estética/saúde), estoque mínimo com alerta, custo médio.

### 4.10 Fiscal
- **NFS-e padrão nacional**: obrigatória para optantes do Simples Nacional a partir de **1º/11/2026** (Res. CGSN 191/2026), MEI desde 2023, e vários municípios já exigem. Integrar via provedor (Focus NFe, NFE.io ou PlugNotas) em vez de falar direto com cada prefeitura.
- Emissão automática ao fechar a comanda (opcional), nota por profissional parceiro (salão-parceiro), cancelamento, envio ao cliente.
- Acompanhar a reforma tributária (CBS/IBS, LC 214/2025): os campos novos da NFS-e nacional entram pelo provedor.
- Exportação para contador (XML das notas + relatório de receitas/despesas por competência).

### 4.11 Módulos de saúde e estética
- **Anamnese** com formulários configuráveis (construtor de campos: texto, múltipla escolha, escala, assinatura) e modelos por segmento; cliente pode preencher antes pelo link.
- **Termo de consentimento** com assinatura eletrônica (desenho na tela + IP + data/hora + hash do documento).
- **Fotos antes/depois** com comparação lado a lado, marcação de região, armazenamento privado com URL assinada.
- **Prontuário eletrônico**: modelos por especialidade (modelo inicial segundo CFM), evolução, CID-10/11, prescrição e atestado em PDF, anexos de exames. Registro fechado não se edita — adendo novo (regra do CFM). Guarda mínima de 20 anos (Lei 13.787/2018). Assinatura digital ICP-Brasil e certificação SBIS como meta posterior.
- **Teleconsulta** (fase 5): sala de vídeo com link (LiveKit/Daily), gravação só com consentimento.
- **Convênios** (fase 5): tabelas (TUSS/CBHPM), guias TISS (consulta, SP/SADT), lotes XML, controle de glosa.

### 4.12 Multiunidade, equipe e configuração
- Várias unidades com relatórios consolidados e por unidade; profissional pode atender em mais de uma.
- Ponto/escala simples, metas por profissional.
- Configurações: horário de funcionamento, feriados (importados por cidade), formas de pagamento e taxas, políticas de cancelamento, modelos de mensagem, identidade visual da página pública (logo, cores).
- **Auditoria**: quem criou, mudou, cancelou, deu desconto, estornou (tabela `audit_log` imutável).

### 4.13 Admin da plataforma (nosso)
- Painel de contas, assinatura do SaaS (trial com cartão, planos, inadimplência — reaproveitar o `MONETIZACAO.md` do Turmei), métricas de uso, suporte "entrar como" (com consentimento e registro), feature flags.

### 4.14 IA (diferencial, fase 6)
- Assistente que agenda pelo WhatsApp em linguagem natural ("tem horário sexta à tarde com a Ju?") usando a API de disponibilidade.
- Previsão de no-show (pede sinal para quem tem risco alto).
- Sugestão de preenchimento de buracos na agenda e de campanhas.
- Resumo da evolução do prontuário e transcrição da consulta (com consentimento).
- Perguntas em linguagem natural sobre os relatórios ("quanto a Ana faturou em setembro?").

---

## 5. Experiência: mobile × desktop

Uma única base Next.js, mas **duas composições de layout** — não apenas "esticar" o mobile.

| | Mobile (< 1024 px) | Desktop (≥ 1024 px) |
|---|---|---|
| Navegação | Barra inferior (Início, Serviços, Equipe, Mais) | **Sidebar** fixa com seletor de negócio |
| Agenda | Dia de um profissional por vez, deslizar entre dias/profissionais | **Grade multiprofissional** (colunas por recurso), arrastar e soltar, mini-calendário lateral, painel de lista de espera |
| Detalhes | **Bottom sheets** (vaul, padrão do Turmei) | **Painel lateral** à direita (o mesmo `Sheet`, que muda de direção no desktop) |
| Listas | Cards | **Tabelas densas**: ordenar, filtrar, colunas configuráveis, seleção em massa, exportar |
| Relatórios | KPIs + 1 gráfico por vez | Dashboard em grade, vários gráficos, drill-down (clicar na barra abre a lista) |
| Produtividade | Ações grandes para o polegar | **Paleta de comandos** (⌘K), **atalhos de teclado** (N = novo agendamento, / = buscar, ← → = dias), múltiplas abas |
| Extra | Instalar como app, push, câmera para fotos antes/depois | Modo recepção em tela cheia, painel de TV (chamada), impressão de recibo |

Princípios:
- Componentes de dados agnósticos de layout (hooks `useServices`, `useMembers`…), "cascas" diferentes por breakpoint.
- Atualização **em tempo real** da agenda entre recepção e profissionais (SSE ou WebSocket) — dois atendentes não marcam o mesmo horário.
- Otimista com TanStack Query; **offline leitura** da agenda do dia (Service Worker) e fila de ações para quando a rede voltar.
- Acessibilidade e seletores por papel/rótulo (Playwright roda nos dois tamanhos), tema claro/escuro por `data-theme` (convenção do Turmei).

---

## 6. Arquitetura técnica

### 6.1 Decisões

| Decisão | Motivo |
|---|---|
| **Reaproveitar o monorepo do Turmei** (pnpm + Turbo, `apps/api`, `apps/web`, `packages/contracts`) | Mesma equipe, mesmas convenções, segurança já resolvida (CSP com nonce, crypto de campos, revogação de sessão, OAuth). |
| **Multi-tenant em banco único com `organizationId` em todas as tabelas** + guard global `OrgGuard` + **RLS** (rotas de negócio em transação com `app.org_id` e papel `skedulei_tenant` sem BYPASSRLS) | Simples de operar; o banco barra vazamento mesmo se uma consulta esquecer o filtro. |
| **`packages/contracts` com regras puras testadas**: perfis e permissões, segmentos, horário de funcionamento, slug; depois disponibilidade de horário, comissão, DRE, política de cancelamento | Mesma regra na API e no web. |
| **Motor de disponibilidade** como módulo isolado | É a parte mais crítica e mais testada: horários × bloqueios × recursos × buffers × agendamentos. |
| **Filas com pg-boss** (Postgres) em vez de Redis no início | Lembretes, WhatsApp, NFS-e, webhooks, relatórios pesados; uma dependência a menos (funciona no Supabase). |
| **Tempo real** com SSE via NestJS + `LISTEN/NOTIFY` do Postgres | Leve, sem infraestrutura extra. |
| **Armazenamento de arquivos** em bucket S3-compatível (Supabase Storage/R2) com URL assinada e expiração curta | Fotos clínicas e prontuário são dados sensíveis. |
| **Pagamentos via Asaas** (PIX, boleto, cartão, assinaturas, subcontas e **split**) com camada `PaymentProvider` para trocar por Mercado Pago/Pagar.me | Split é só via API e roda no recebimento — ideal para sinal e comissão online. |
| **Dinheiro em centavos, datas `'YYYY-MM-DD'`, instantes UTC, fuso por unidade** | Convenções já provadas no Turmei. |
| **Relatórios** com *views* materializadas atualizadas por job + consultas diretas para o dia corrente | DRE e coortes ficam rápidos mesmo com anos de dados. |

### 6.2 Diagrama

```
  Cliente final (página pública PWA)     Equipe (PWA mobile / desktop web)
              │                                      │
              └──────────────┬───────────────────────┘
                             │ HTTPS /v1/*  (JWT + x-organization-id)
              ┌──────────────▼───────────────────────────────┐
              │ apps/api (NestJS)                              │
              │  auth · negócios/unidades · equipe · serviços  │
              │  agenda + disponibilidade · booking público    │
              │  clientes · comanda/PDV · financeiro · caixa   │
              │  comissões · estoque · fiscal · mensagens      │
              │  saúde (anamnese, prontuário) · relatórios     │
              │  eventos internos (event-emitter) · SSE        │
              └───┬──────────────┬───────────────┬────────────┘
                  │ TypeORM      │ pg-boss jobs  │ webhooks
           ┌──────▼─────┐  ┌─────▼────────┐  ┌───▼──────────────────────────┐
           │ PostgreSQL │  │ Workers      │  │ Asaas · WhatsApp Cloud API   │
           │ (+ RLS)    │  │ lembretes,   │  │ Resend · Web Push · NFS-e    │
           └────────────┘  │ NFS-e, views │  │ (Focus/NFE.io) · Storage     │
                           └──────────────┘  └──────────────────────────────┘
```

### 6.3 Modelo de dados (principais tabelas)

- **Conta** (Fase 0 ✅): `users`, `organizations` (segmento, módulos, slug), `units` (endereço, fuso, horário), `members` (pessoa × negócio × perfil; com ou sem conta; convite), `services`. Depois: `role_permission` (ajustes por negócio), `subscription` (SaaS).
- **Agenda**: `professional_service` (preço/duração/comissão próprios), `resource` (sala/equipamento), `working_hours`, `time_off`, `holiday`, `service_variant`, `service_resource`, `appointment`, `appointment_item` (serviço × profissional × início/fim), `recurrence_rule`, `waitlist_entry`, `booking_policy`.
- **Clientes**: `client` (CPF cifrado + blind index), `client_guardian`, `client_tag`, `consent`, `review`.
- **Vendas**: `order` (comanda), `order_item` (serviço/produto/pacote), `payment`, `payment_method` (+ taxas), `package`, `client_package` (saldo), `membership_plan`, `client_membership`, `gift_card`, `coupon`.
- **Financeiro**: `account` (banco/caixa), `cash_session`, `cash_movement`, `chart_of_accounts`, `cost_center`, `payable`, `receivable`, `bank_statement_line`, `reconciliation`.
- **Comissão**: `commission_rule`, `commission_entry`, `commission_payout`, `advance` (vale).
- **Estoque**: `product`, `supplier`, `stock_movement`, `service_supply` (ficha técnica), `inventory_count`.
- **Fiscal**: `fiscal_config`, `invoice` (NFS-e).
- **Saúde/Estética**: `form_template`, `form_response` (anamnese), `consent_document`, `signature`, `clinical_photo`, `medical_record_entry` (imutável, com adendos), `prescription`, `insurance_plan`, `tiss_guide` (fase 5).
- **Comunicação**: `message_template`, `message_log`, `campaign`, `push_subscription`.
- **Plataforma**: `audit_log`, `security_events` (✅), `saved_report_filter`, `webhook_event` (idempotência).

---

## 7. Segurança, LGPD e conformidade

- Dados de saúde são **dados pessoais sensíveis** (LGPD art. 11): base legal de tutela da saúde, acesso mínimo por papel, cifragem de campos sensíveis (`encryptField`), logs de acesso ao prontuário.
- Isolamento entre organizações testado em e2e (`apps/api/test/organizations.e2e-spec.ts`).
- Prontuário imutável com adendos, guarda de 20 anos, exportação ao paciente.
- Fotos clínicas nunca públicas; URL assinada de minutos.
- 2FA obrigatório para dono e para quem acessa prontuário (quando o módulo existir).
- Backups diários com teste de restauração; política de retenção; DPA e termos para o cliente B2B (somos operadores dos dados dos pacientes deles).
- Herdado do Turmei: SSRF allowlist, CSV injection, `safeNext`, CSP com nonce (ver `docs/SEGURANCA.md`).

---

## 8. Roadmap por fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 — Fundação** ✅ | Monorepo a partir do Turmei, multi-tenant (guard + RLS), RBAC, onboarding com escolha de segmento, layout mobile/desktop, design system. | Dono cria conta, unidade, equipe e serviços. |
| **1 — MVP Agenda** ✅ (OTP e avisos automáticos vão para a fase 4) | Motor de disponibilidade, agenda multiprofissional (arrastar/soltar, recurso), clientes, página pública de agendamento com OTP, lembretes por `wa.me`/e-mail/push, check-in, status. | Um salão real usa no dia a dia sem papel. |
| **2 — Caixa e comissão** ✅ (caixa, comanda, taxas, comissões, painel, contas a pagar/receber, DRE, fluxo de caixa e importação de clientes por CSV; fora: anexos de boleto, centros de custo, transferências entre contas, antecipação, repasse de saúde) | Comanda/PDV, formas de pagamento com taxas, caixa, contas a pagar/receber, comissões e fechamento, painel do dono, relatórios básicos, importação de clientes. | Fechamento do mês feito só no sistema. |
| **3 — Fidelização e estoque** (5 sem.) | Pacotes, assinaturas/clube, vale-presente, estoque e ficha técnica, avaliações, lista de espera, fidelidade, painel de TV. | Clínica de estética usa pacotes e insumos. |
| **4 — Pagamento online e automação** (5 sem.) | Asaas (sinal, no-show, link de pagamento, assinatura recorrente, split), WhatsApp Cloud API com confirmação por resposta, campanhas, NFS-e, DRE e fluxo de caixa completos, conciliação OFX, Reserve with Google. | No-show cai de forma mensurável; notas saem sozinhas. |
| **5 — Saúde** (6 sem.) | Anamnese configurável, termos com assinatura, fotos antes/depois, prontuário, prescrição/atestado, teleconsulta, convênios e TISS. | Consultório médico migra de Feegow/iClinic. |
| **6 — Escala e IA** | Multiunidade consolidado, app nativo (Capacitor) se a PWA limitar, assistente de agendamento no WhatsApp, previsão de no-show, relatórios em linguagem natural, odontograma, API pública e integrações. | — |

---

## 9. Modelo de negócio (proposta)

| Plano | Para | Inclui | Preço de referência |
|---|---|---|---|
| **Solo** | Profissional autônomo | 1 agenda, agendamento online, lembretes `wa.me`, financeiro básico | R$ 39–59/mês |
| **Equipe** | Salão/clínica pequena | Por profissional ativo: comissão, caixa, estoque, pacotes, relatórios | R$ 29–39/profissional/mês |
| **Clínica** | Saúde | + prontuário, anamnese, termos, teleconsulta | R$ 79–129/profissional/mês |
| **Rede** | Multiunidade | + consolidado, API, suporte dedicado | Sob consulta |
| **Add-ons** | — | WhatsApp oficial (por pacote de mensagens), NFS-e (por nota), taxa sobre pagamento online | Uso |

Trial de 14 dias; migração assistida de concorrentes como argumento de venda.

---

## 10. Métricas de sucesso do produto

- Tempo para criar um agendamento na recepção (meta: < 10 s no desktop).
- % de agendamentos feitos online pelo próprio cliente.
- Taxa de no-show antes × depois (meta: −40% com lembrete + confirmação + sinal).
- Ocupação média da agenda.
- Retenção das contas (logo churn mensal < 3%) e ativação (1º agendamento em 24 h).

---

## 11. Próximos passos

1. Validar este plano com 3–5 negócios reais (1 salão, 1 barbearia, 1 estética, 1 consultório) — entrevistas sobre o que mais dói hoje.
2. Escolher o nome e registrar domínio.
3. **Resto da Fase 2**: contas a pagar/receber, DRE gerencial e fluxo de caixa, importação de clientes (CSV).

---

## Fontes consultadas

- Booksy — No-Show Protection: https://biz.booksy.com/features/no-show-protection
- Fresha — Payment policies: https://www.fresha.com/help-center/knowledge-base/payments/613-payments-policies-overview
- Fresha — No-shows e cancelamentos: https://www.fresha.com/blog/how-to-protect-your-business-against-no-shows-and-late-cancellations
- Comparativos Fresha × Booksy: https://toolradar.com/compare/fresha-vs-booksy · https://www.salonbookingsystem.com/salon-booking-system-blog/examples-of-booking-systems
- Trinks (Capterra): https://www.capterra.com/p/252863/Trinks/ · App Store: https://apps.apple.com/ng/app/trinks-com/id628518776
- Feegow / Doctoralia: https://startups.com.br/negocios/doctoralia-compra-brasileira-feegow-e-mira-gestao-para-clinicas/ · https://medicinasa.com.br/feegow-clinic-gestao-integrada/
- iClinic — central de ajuda (TISS, prontuário, teleconsulta): https://intercom.help/iclinic-bc30384852a6/pt-BR/
- NFS-e nacional (Simples, novembro/2026): https://documentacao.senior.com.br/exigenciaslegais/noticias/federal/2026/2026-08-11-simples-nacional-resolucao-cgsn-no-191-2026-utilizacao-do-emissor-da-nfs-e-de-padrao-nacional-sera-a-partir-de-novembro
- Asaas — Split de pagamento: https://docs.asaas.com/docs/split-de-pagamentos · FAQ: https://docs.asaas.com/docs/faq-do-split
