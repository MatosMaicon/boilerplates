# ADR 0006: Auth — Better Auth como biblioteca dentro da API

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

Autenticação é a decisão que mais custa reverter num projeto novo, e a que mais tenta o caminho do
"vamos usar um IdP pronto". As opções reais são três:

1. **IdP self-hosted** (Keycloak, Zitadel): completo, mas é mais um serviço para operar, atualizar e
   monitorar — e cria o problema do **espelhamento**: a identidade vive lá, o domínio vive no seu
   banco, e alguém precisa manter os dois em sincronia.
2. **IdP gerenciado** (Auth0, Clerk, Cognito): tira a operação, mantém o espelhamento, e adiciona
   custo por usuário e dependência de rede no caminho crítico de cada request.
3. **Biblioteca dentro da própria API:** identidade e domínio na mesma tabela, sem serviço extra.

O ponto decisivo para o boilerplate é o espelhamento. Um IdP externo obriga, desde o primeiro dia, a
decidir o que é canônico e a escrever a reconciliação (`/auth/sync`, webhooks, claims espelhados).
É complexidade real cobrada antes de existir um usuário.

## Decisão

**Não há IdP externo.** O **Better Auth roda como biblioteca dentro do `apps/api`**: a API é o auth
server, serve as rotas `/auth/*` e grava identidade **e** domínio na mesma tabela `users`.

- **Montagem direta no Express** (~5 linhas em `main.ts`), sem wrapper de terceiros.
- **Sessão em cookie httpOnly**, resolvida no backend a cada request. Sem token OIDC a renovar.
- **Guard global do NestJS** resolve a sessão via `auth.api.getSession()` — consulta ao mesmo
  Postgres, sem chamada de rede, e revogação com efeito imediato.
- **IDs em UUID** (`advanced.database.generateId`), para casar com as FKs de domínio.
- **Papéis não são acumuláveis:** `users.role` é um enum único.
- **Trava de escalonamento:** campos privilegiados são declarados com `input: false` nos
  `additionalFields` — nenhum payload público de cadastro consegue setá-los.
- **Rate limit é do Better Auth**, com `storage: 'database'`. Ver *Consequências*.

## Consequências

**Positivo:**
- Um serviço a menos para operar; nada de subdomínio de auth nem de tema customizado de login.
- **Sem espelhamento:** `email`, `role` e o que mais for de domínio são canônicos na `users`. Não
  existe rota de sincronização nem claim a reconciliar.
- Telas de login/cadastro/reset são componentes do seu frontend — controle total de UX.
- Sessão resolvida contra o próprio banco: sem latência de rede a IdP no caminho de cada request.

**Negativo:**
- ⚠️ **As rotas `/auth/*` ficam fora do router do Nest**, e isso tem duas consequências que mordem:
  - **Guards do Nest não as alcançam** — inclusive o `@nestjs/throttler`. A proteção contra força
    bruta em login e reset **precisa** vir do `rateLimit` do próprio Better Auth.
  - **Middleware registrado depois do mount não roda para elas** — por isso o helmet é registrado
    antes.
  - Elas também **não entram no OpenAPI** (exceção consciente ao ADR 0003).
- A ordem de montagem é frágil: o handler precisa do corpo cru, então vai **antes** dos body
  parsers (`bodyParser: false` no `NestFactory.create`). Inverter faz as requisições pendurarem.
- Features que um IdP maduro dá de graça (SSO corporativo, SAML, federação complexa, MFA avançado)
  passam a ser trabalho nosso.
- O `better-auth` declara peers opcionais que afetam a árvore de produção — ver
  [ADR 0007](0007-lockfile-legacy-peer-deps.md).

## Alternativas consideradas

- **Keycloak / Zitadel self-hosted:** completo e testado, mas adiciona um serviço para operar e o
  problema de espelhamento desde o dia zero.
- **Auth0 / Clerk gerenciado:** menos operação, mas custo por usuário, dependência externa no
  caminho crítico e o mesmo espelhamento.
- **Wrapper NestJS para o Better Auth** (ex.: `@thallesp/nestjs-better-auth`): açúcar sintático
  sobre o que a montagem direta já faz em ~5 linhas, ao custo de mais uma dependência entre nós e a
  biblioteca de auth.
- **Auth caseiro (JWT + bcrypt à mão):** máxima flexibilidade, e a forma mais confiável de
  introduzir uma vulnerabilidade sutil. Descartado.

## Ponto de reavaliação

Se surgir requisito de SSO corporativo (SAML, SCIM) ou de compartilhar identidade entre vários
produtos, um IdP externo volta à mesa. O seam do guard (`@Public`, `@CurrentUser`, `@Roles`) foi
mantido estável justamente para que essa troca não se espalhe pelo código.
