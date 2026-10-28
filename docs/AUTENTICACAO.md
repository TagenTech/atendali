# Autenticação e cadastro

Status: **implementado**. Uma **conta** (`users`) pode estar em vários negócios, com um perfil em cada (`members`); os dados do negócio são isolados por `organization_id` (filtro no código + RLS). O cliente final que agenda **não tem conta**: usa o link da reserva, ou a área "Minhas reservas" (código no e-mail cadastrado no celular) — ver [SEGURANCA.md](SEGURANCA.md).

## Formas de entrar

| Forma | Como funciona |
|---|---|
| **E-mail e senha** | `/cadastro` → conta criada e já logada → link de confirmação por e-mail (válido 3 dias). "Esqueci minha senha" manda link de 1 hora. |
| **Google** | OAuth 2.0 + PKCE. E-mail confirmado pelo Google: liga automaticamente a uma conta existente com o mesmo e-mail. |
| **Microsoft (Outlook, Hotmail, Live, contas de trabalho)** | OAuth 2.0 + PKCE (tenant `common`). Por segurança **não** liga a uma conta existente pelo e-mail (contas corporativas podem declarar qualquer e-mail). |
| **Meta (Facebook)** | OAuth 2.0. Exige permissão de e-mail (a Meta só devolve e-mails confirmados). |

Botões sociais só aparecem quando as credenciais do provedor estão configuradas (`GET /v1/auth/providers`).
Quem entrou só pelo social pode **criar uma senha** em Mais → Criar senha.

## Fluxo técnico

```
Navegador ──GET /api/v1/auth/oauth/google──▶ API (gera state + PKCE, cookie httpOnly 10 min)
          ◀── 302 para o Google
Google ──▶ /api/v1/auth/oauth/google/callback?code&state
          API confere state, troca o code, lê o perfil,
          acha/liga/cria a conta, grava cookie de sessão
          ◀── 302 para /hoje  (ou /hoje?bemvindo=1 na primeira vez)
```

- O retorno passa pelo **mesmo domínio do web** (rewrite do Next / nginx), então o cookie de sessão é do app.
- Cookie de sessão: `httpOnly`, `Secure` em produção, `SameSite=Lax` (necessário para a volta do provedor; o
  refresh é `POST`, que entre sites não leva cookie `Lax` — continua protegido contra CSRF).
- Tokens de e-mail e refresh são guardados só como hash SHA-256; uso único; reuso de refresh derruba todas as sessões.
- Limites: cadastro 10/h por IP, esqueci-senha 5/h, login 5/min.
- "Esqueci minha senha" responde igual existindo ou não a conta. O cadastro com e-mail já usado manda um aviso
  para o dono do e-mail.

## Configurar cada provedor

URL de retorno (redirect URI) — use a URL pública do web (`PUBLIC_WEB_URL`):

```
https://SEU_DOMINIO/api/v1/auth/oauth/google/callback
https://SEU_DOMINIO/api/v1/auth/oauth/microsoft/callback
https://SEU_DOMINIO/api/v1/auth/oauth/facebook/callback
```

Em desenvolvimento: `http://localhost:3201/api/v1/auth/oauth/<provedor>/callback`.

### Google
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs e serviços → **Tela de consentimento OAuth** (externo; escopos `email`, `profile`, `openid`).
2. **Credenciais** → Criar → ID do cliente OAuth → *Aplicativo da Web* → adicione a redirect URI.
3. `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da API.
4. Publique o app na tela de consentimento (em "teste" só os e-mails cadastrados conseguem entrar).

### Microsoft (Outlook)
1. [Portal Azure](https://portal.azure.com/) → **Microsoft Entra ID → Registros de aplicativo → Novo registro**.
2. Tipos de conta: *Contas em qualquer diretório organizacional e contas pessoais da Microsoft*.
3. Redirect URI: plataforma **Web** + a URL acima.
4. **Certificados e segredos** → novo segredo do cliente.
5. `MICROSOFT_CLIENT_ID` (ID do aplicativo) e `MICROSOFT_CLIENT_SECRET` (valor do segredo — anote a validade e renove antes).

### Meta (Facebook)
1. [Meta for Developers](https://developers.facebook.com/) → Criar app → caso de uso **Autenticar e solicitar dados de usuários com o Login do Facebook**.
2. Permissões: `email` e `public_profile`.
3. Login do Facebook → Configurações → **URIs de redirecionamento do OAuth válidos** → a URL acima.
4. `FACEBOOK_CLIENT_ID` (ID do app) e `FACEBOOK_CLIENT_SECRET` (chave secreta).
5. Coloque o app em modo **Ao vivo** (exige URL de Política de privacidade: `https://SEU_DOMINIO/privacidade`).

## E-mail (Resend)

1. Crie conta em [resend.com](https://resend.com), verifique o domínio (registros DNS SPF/DKIM).
2. `RESEND_API_KEY` e `MAIL_FROM="Skedulei <nao-responda@seudominio.com.br>"`.
3. Sem chave, em desenvolvimento nada sai: os links aparecem no log da API e em `GET /v1/dev/outbox`
   (rota que **não existe em produção**).

## Finalizar cadastro

Depois de entrar, o app mostra "Finalize seu cadastro" (tela Hoje e Mais → perfil):
nome completo, **CPF** (validado pelos dígitos verificadores, único por conta), **celular** e cidade/UF.

- O CPF é dado pessoal: fica **cifrado (AES-256-GCM)** no banco, com índice HMAC para checar duplicidade, e
  **nunca volta inteiro para o navegador** (só `***.982.247-**`).
- Base para a futura cobrança da licença (identificação do titular, nota fiscal, gateway) — ver [MONETIZACAO.md](MONETIZACAO.md).
- Variável `SIGNUP_ENABLED=false` fecha o cadastro público (contas só pelo `pnpm api:create-user`).

## Segurança da conta (Mais → Segurança da conta)

- **Verificação em duas etapas (TOTP):** QR code para Google Authenticator, 1Password, Authy etc. Ao ativar, o app
  mostra 10 códigos de recuperação de uso único (copiar/baixar). No login, depois da senha ou do login social, a tela
  `/login/2fa` pede o código. Desativar ou gerar novos códigos exige um código válido.
- **Aparelhos conectados:** cada refresh token pertence a uma sessão; dá para encerrar uma ou todas as outras.
- **Revogação imediata:** sair, trocar/redefinir senha e excluir conta invalidam também o access token (não esperam os 15 min).
- **Atividade recente:** entradas, falhas, bloqueios, 2FA e trocas de senha (tabela `security_events`, 365 dias).
- **Excluir minha conta:** pede senha (ou código 2FA, para contas só com login social) e apaga todos os dados.

## Pendências recomendadas
- Revisar Termos e Política de privacidade com assessoria jurídica (as páginas `/termos` e `/privacidade` são rascunho).
- Login com Apple (obrigatório se um dia houver app nativo na App Store com login social).

## Regras de segurança do login (testadas)

- **Senha**: mínimo de 8 caracteres e **sem senhas comuns** (`12345678`, `password123`, sequências) — a tela e a API recusam (`passwordProblem` em `packages/contracts/src/password.ts`). Cadastro, troca e redefinição pedem **confirmação** da senha; a redefinição vale por 1 hora, uma vez só, e encerra todas as sessões.
- **Login social**: provedor que **garante o e-mail** (Google, Meta) liga a uma conta existente com o mesmo e-mail; a **Microsoft não garante**, então cria a conta como *não confirmada* e nunca liga a uma conta existente.
- **Sequestro prévio**: se uma conta foi criada com o e-mail de outra pessoa (por senha ou pela Microsoft) e o dono real entra depois por um provedor que garante o e-mail, a conta passa ao dono e **senha, logins sociais e sessões antigas são apagados**.
- **Força bruta**: 5 senhas erradas por e-mail → bloqueio de 15 min; 5 logins/min por IP. Os contadores ficam **na memória do processo** (só valem com uma instância — ver [LANCAMENTO.md §4](LANCAMENTO.md#4-limite-de-tentativas-e-bloqueio-de-login)).
- **2FA** opcional (app autenticador + códigos de recuperação) vale também para o login social.
- A recuperação de senha **só funciona em produção com e-mail configurado** (Resend) — [LANCAMENTO.md §2](LANCAMENTO.md#2-e-mail-e-recuperação-de-senha).
