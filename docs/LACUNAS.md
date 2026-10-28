# Lacunas da aplicação — análise de 28/10/2026

Visão de quem **usa o produto de verdade**: o cliente/paciente que agenda e a clínica/salão que atende. Cada item diz o que
existe hoje (com a evidência no código), o impacto e o que propor. Prioridade: 🔴 antes de lançar · 🟡 logo depois ·
🟢 roadmap. O plano de fases está em [PLANO.md](PLANO.md); o que falta de segurança/infra está em [LANCAMENTO.md](LANCAMENTO.md).

## Andamento (atualizado em 28/10/2026)

| Lacuna | Situação |
|---|---|
| #3 Responsável × paciente | ✅ **feito**: reserva "para outra pessoa" (nome, nascimento, parentesco), vários pacientes por telefone, ficha com responsável e "mesmo telefone", importação por telefone + nome |
| #1 Rever/cancelar depois de marcar | ✅ **feito** (camadas 1 e 2): reservas neste aparelho, `.ics`, e **Minhas reservas** com código no e-mail cadastrado; ⏳ login rápido/conta de cliente e código por WhatsApp (Fase 4) |
| #6 Remarcar | ✅ **feito**: pelo link da reserva e em Minhas reservas (mesma antecedência de 2 h; avisa a lista de espera) |
| Taxa de agendamento (sinal) | ⏳ opção visível e **desligada** ("Em breve") em Configurações; liga com o pagamento online (Fase 4) |
| #2 Vários procedimentos (carrinho) | ✅ **feito**: escolher até 5 procedimentos; "um logo após o outro" (encaixe automático, mesma pessoa se estiver livre) ou "horário de cada um" (sem sobreposição); tudo ou nada; um link para ver, remarcar um item e cancelar um ou tudo. ⏳ combos com preço fechado e escolha de profissional por item |
| #5 Módulos de saúde | ✅ **feito (mínimo)**: módulos sem tela viram "Em breve" e não ligam; **prontuário** (evolução, prescrição, atestado), **anamnese** e **termo de consentimento** com modelos editáveis, link para o paciente preencher no celular e preenchimento no balcão, tudo cifrado e com acesso registrado. ⏳ Fase 5 completa: assinatura digital (ICP-Brasil), fotos antes/depois, convênios/TISS, teleconsulta, adendo em vez de apagar |
| #4 Lembretes | ✅ **feito (e-mail)**: lembrete 24 h e 2 h antes com botão para confirmar presença, remarcar ou cancelar; aviso à equipe a cada reserva online, remarcação e cancelamento; liga/desliga em Configurações. ⏳ WhatsApp oficial (Fase 4) e lembrete para quem não deixou e-mail |
| #8 Gestão | ✅ **relatórios** (faltas, ocupação, ticket, retorno, ranking de serviços e equipe), **clientes sem voltar** e **aniversariantes** com mensagem pronta no WhatsApp; ✅ **trilha de auditoria** do dinheiro (tela Atividade). ⏳ agenda recorrente, intervalo entre atendimentos, perfil do profissional, férias/ausências, recibo, divulgar a agenda (QR) |
| #7 sinal | ⏳ depende do gateway (Fase 4) |

## Resumo

| # | Lacuna | Quem sente | Prio. |
|---|---|---|---|
| 1 | Cliente **não consegue rever, remarcar nem cancelar** depois de sair da tela (só existe o link da tela de confirmação) | cliente | 🔴 |
| 2 | **Mais de um procedimento** só marcando um por um | cliente | 🔴 |
| 3 | **Responsável × paciente** (pediatria, família): o mesmo telefone vira **um único cadastro** | clínica e cliente | 🔴 |
| 4 | **Sem lembrete nem aviso** automático (e confirmação só por e-mail opcional) | clínica (faltas) | 🔴/🟡 |
| 5 | Módulos de **saúde ligados por padrão sem tela** (anamnese, prontuário, termos, salas…) | clínicas | 🔴 |
| 6 | Cliente **não pode remarcar**; sem "adicionar ao calendário" | cliente | 🟡 |
| 7 | **Sem pagamento/sinal** na reserva (no-show) | clínica | 🟡 |
| 8 | Gestão: relatórios, reativação de clientes, agenda recorrente, intervalo entre atendimentos, perfil do profissional | clínica | 🟡 |
| 9 | Fase 5/6 (saúde completa, multiunidade, NFS-e…) | clínica | 🟢 |

---

## Jornada do cliente

### 1. "Não sei meus horários e não consigo cancelar" 🔴
**Hoje:** a reserva gera um link `/reserva/<token>` mostrado **uma única vez**, na tela de confirmação
(`BookingService.book` → `router.push('/reserva/…')`). O e-mail com o link só sai **se a pessoa digitou e-mail**, que é opcional
(`PublicBookingDto.email`). Se fechou a aba sem salvar o link, **perdeu o acesso**: não há "Minhas reservas", nem consulta
por telefone (a API pública só tem `GET orgs/:slug`, `…/slots`, `POST …/bookings`, `GET/POST bookings/:token`).
**Impacto:** cliente liga ou escreve para a clínica para cancelar → sobrecarga e faltas sem aviso.

**Por que "só o telefone" não basta:** quem souber o número veria nome, procedimento e horário de outra pessoa — em clínica,
isso revela **dado de saúde** (LGPD art. 11). Precisa de uma **prova de posse do telefone** (código de uso único).

**Proposta (em camadas, da mais barata à ideal):**
1. **Já (sem custo):** (a) a tela de confirmação guarda a reserva **neste aparelho** e a página do negócio passa a mostrar
   "Suas reservas" (lista local, só de quem marcou ali); (b) botões *Copiar link*, *Enviar para meu WhatsApp*, *Adicionar ao
   calendário (.ics/Google)*; (c) pedir o e-mail com destaque ("para receber o comprovante") e, se vier, mandar também por lá.
2. **Visitante com consulta por telefone (código por e-mail/WhatsApp/SMS):** "Já marquei → ver minhas reservas": informa o
   celular, recebe um **código de 6 dígitos** (expira em 5 min, 5 tentativas, limite por IP e por número) e abre uma sessão
   curta só de leitura/cancelamento das reservas **daquele número naquele negócio**. O canal automático (WhatsApp Cloud API)
   é da Fase 4; enquanto isso, código por **e-mail** quando houver e-mail cadastrado.
3. **Login rápido no momento de agendar:** a mesma verificação do item 2 acontece **ao escolher o horário** ("confirmar
   meu celular"), cria uma **conta de cliente** leve (telefone verificado, sem senha) e mantém a sessão por 30 dias no aparelho.
   Benefícios: histórico, pontos e pacotes visíveis ao cliente, menos reservas falsas, base para pagamento e avaliação.
   É o desenho que o PLANO já previa ("OTP no agendamento online", adiado para a Fase 4).

### 2. Vários procedimentos de uma vez 🔴
**Hoje:** a página pública escolhe **um** `serviceId` e `PublicBookingDto` aceita um só; cada reserva é independente
(sem agrupamento). Quem quer corte + barba + hidratação refaz o fluxo três vezes e **pode ficar com horários soltos**
(ou perder o horário seguinte enquanto marca o primeiro).

**Proposta — "carrinho" na página pública:**
- Passo 1: marcar **vários** procedimentos (resumo com total de tempo e valor).
- Passo 2: escolher **como encaixar**:
  - **Em sequência** (um logo após o outro, mesmo dia): o motor procura início em que cada procedimento tenha profissional livre
    em `s`, `s+d1`, `s+d1+d2`… (pode ser a mesma pessoa ou pessoas diferentes);
  - **Em horários separados** (o que você descreveu): para cada procedimento escolhido, a pessoa **escolhe o dia e o horário
    um a um**, com a lista revalidada a cada escolha (o horário já escolhido de um procedimento bloqueia o conflito com o outro).
- Backend: `POST …/bookings` passa a receber `items: [{ serviceId, memberId?, startsAt }]`, gravado **numa única transação**
  (tudo ou nada, `assertFree` para cada item) sob um `booking_group_id` e **um token só**. A tela "Minha reserva" lista os
  itens, cancela **um** ou **todos**, e a comanda junta os itens do grupo.
- Regras a ajustar: teto de 3 horários por telefone conta **por item**; lista de espera e avaliação seguem por item.
- Evolução: **combos** (ex.: "Dia da noiva") com preço fechado e duração própria.

### 3. Responsável × paciente (pediatria, família) 🔴
**Hoje:** o cliente é identificado **pelo telefone dentro do negócio** (`booking.service.ts`: `findOne({ organizationId, phone })`).
Uma mãe que marca para **dois filhos** com o mesmo celular cai **no mesmo cadastro** — o segundo nome é descartado — e o
prontuário/histórico dos irmãos se mistura. O vídeo de demonstração contornou isso escrevendo "Mariana (mãe da Sofia)" no nome.
O cadastro também não tem **responsável legal**, parentesco, convênio nem alertas.
**Proposta:** separar **contato** (quem tem o telefone/e-mail) de **paciente** (quem é atendido): um contato com N pacientes
(dependentes); na reserva, "Para quem é?" → *eu* / *outra pessoa* (nome + nascimento); ficha com responsável, parentesco e
convênio. Migração: manter o cliente atual como paciente e criar o contato a partir do telefone.

### 4. Lembretes e avisos 🔴/🟡
**Hoje:** não há lembrete automático nem WhatsApp/SMS (busca por `twilio|sms|reminder|lembrete` no código da API: nada). A
confirmação ao cliente sai **só por e-mail opcional**; a equipe tem o botão manual "Chamar" e o link `wa.me`. O PLANO adia
lembretes automáticos e a confirmação por resposta ("responda 1") para a **Fase 4** (WhatsApp Cloud API).
**Impacto:** é a maior alavanca contra faltas.
**Proposta:** (agora) lembrete por **e-mail** 24 h e 2 h antes quando houver e-mail, com botões *Confirmo / Preciso remarcar* e
fila "a confirmar" na agenda; (Fase 4) WhatsApp oficial; avisar a **equipe** (push/e-mail) a cada reserva online nova e cancelamento.

### 6. Remarcar e calendário 🟡
O cliente só **cancela** (até 2 h antes, `ONLINE_BOOKING.cancelUntilHours`); para mudar precisa cancelar e marcar de novo
(e arrisca perder o horário). Falta **Remarcar** com a mesma regra de antecedência, o botão de calendário e a
**política de cancelamento** visível (prazo, taxa de no-show) na página.

### 7. Pagamento e sinal 🟡
Não existe agendamento **a partir de uma cobrança** nem sinal/pré-pagamento (depende do gateway — Asaas — da Fase 4). Proposta:
serviço marcado "exige sinal" → reserva fica **pendente** até o Pix; expira em 15 min; sinal abate na comanda; regra de
retenção em caso de falta.

---

## Jornada da clínica/salão

### 5. Módulos de saúde sem tela 🔴
`SEGMENT_PRESETS.CLINICA_MEDICA` liga por padrão `SALAS`, `ANAMNESE`, `TERMOS`, `PRONTUARIO` e `TELECONSULTA`, e a etapa
**Módulos** do onboarding lista todos os módulos do catálogo (inclusive `FOTOS`, `EQUIPAMENTOS`, `CONVENIOS`). **Nenhum
deles tem tela ou API hoje** (busca no web e na API: só aparecem em `segments.ts`) — são a **Fase 5** do plano. A clínica
(pediatria, odontologia…) acredita ter prontuário e anamnese e não tem.
**Proposta (decidir antes de vender para clínicas):** (a) marcar esses módulos como **"em breve"** (desligados e sem promessa)
até existirem; ou (b) construir o mínimo útil primeiro — **anamnese** (formulário que o paciente preenche antes, cifrado),
**termo de consentimento** com assinatura e **evolução/prontuário** simples por consulta.

### 8. Gestão do dia a dia 🟡
| Tema | Situação | Proposta |
|---|---|---|
| **Relatórios** | financeiro e DRE existem; faltam ocupação da agenda, taxa de falta, retorno/retenção, ticket médio, ranking de serviços/profissionais, origem (online × balcão) | tela "Relatórios" + exportar CSV |
| **Reativação e aniversários** | sem campanhas; só pontos/clube | lista "sem voltar há N dias" e "aniversariantes" com mensagem pronta (`wa.me`) |
| **Agenda recorrente** | só horário avulso | repetir semanal/quinzenal/mensal (tratamentos, terapia) |
| **Intervalo entre atendimentos / preparo** | o serviço tem só duração | `bufferMinutes` (limpeza/troca) no motor de horários |
| **Perfil do profissional** | página pública mostra só o nome | foto, especialidade, bio, registro (CRM/CRO) |
| **Ausências** | só "bloqueio" avulso | férias/licença por período, com aviso dos agendamentos afetados |
| **Permissões finas** | perfis fixos | "pode dar desconto > X%", "pode estornar" (previsto no PLANO) |
| **Comprovante/recibo** | sem impressão/PDF da comanda | recibo para o cliente (e do atendimento, para reembolso de convênio) |
| **Convite para marcar** | link e QR da página não são promovidos | tela "Divulgue sua agenda": link, QR para imprimir, texto para o Instagram/WhatsApp |

### 9. Fases seguintes 🟢
Fase 4 (pagamento online, WhatsApp oficial, campanhas, NFS-e, conciliação, Reserve with Google), Fase 5 (saúde completa,
convênios/TISS) e Fase 6 (multiunidade consolidado, app nativo, IA) — ver [PLANO.md](PLANO.md#8-roadmap-por-fases).

---

## Ordem sugerida

1. **Dados e cadastro:** #3 responsável × paciente (corrige corrupção de dados antes de haver clientes reais).
2. **Autonomia do cliente:** #1 camadas 1 e 2 (guardar reserva, .ics, rever/cancelar com código) + #6 remarcar.
3. **Reserva múltipla:** #2 (carrinho com "em sequência" e "horários separados").
4. **Honestidade do produto:** #5 (módulos de saúde "em breve" ou o mínimo de anamnese/termo/prontuário).
5. **Faltas:** #4 lembretes por e-mail + aviso à equipe → WhatsApp (Fase 4) e #7 sinal.
6. **Gestão:** #8 relatórios e reativação.

Cada item acima entra com testes (regras em `packages/contracts`, e2e da API com isolamento entre negócios, Playwright
celular + desktop) e passa pelo `pnpm verify`.
