# Frontend

> Leia também: [CLAUDE.md raiz](../../CLAUDE.md)
>
> ⚠️ **Este app não tem código ainda** — só as convenções abaixo. O boilerplate não escolhe o
> framework por você, mas o **contrato de autenticação** (seção final) é definido pelo backend e
> vale independentemente da escolha.

## Stack

<PREENCHER. O desenho de auth abaixo assume um framework com servidor próprio (Next.js App Router,
Remix, SvelteKit…) atuando como BFF. Se o frontend for uma SPA estática, releia a seção de
autenticação: sem servidor, o cookie httpOnly precisa de outro arranjo.>

| Item | Escolha |
|---|---|
| Framework | <PREENCHER> |
| Estilo | <PREENCHER> |
| Componentes | <PREENCHER> |
| Estado global | <PREENCHER — prefira server-side/fetch antes de adotar store> |
| Formulários | <PREENCHER> |
| Testes | <PREENCHER — E2E de browser vive aqui, não no `apps/api`> |

## Chamadas ao backend

- Todas as chamadas à API concentradas numa camada (`lib/api/`), não espalhadas por componente
- URL base em variável de ambiente (`NEXT_PUBLIC_API_URL` ou equivalente)
- Requisições autenticadas viajam com o **cookie de sessão** (`credentials: 'include'`), não com
  Bearer token — a API tem CORS com `credentials: true` para a origem deste app
- **Tipos vêm do codegen do OpenAPI** da API (ADR 0003). A API é a fonte única da verdade; não
  crie um pacote de tipos compartilhado nem redigite interfaces à mão
- ⚠️ As rotas `/auth/*` **não** estão no OpenAPI (são servidas fora do router do Nest). O contrato
  delas precisa ser documentado à mão

## Autenticação (BFF sobre o Better Auth)

**Não há IdP externo nem página de login hospedada por terceiros** (ADR 0006). O auth server é o
próprio `apps/api`; este app desenha as telas e atua como **BFF**.

- **As telas de login/cadastro/reset são suas**, consumindo os endpoints `/auth/*` da API
- **Sessão em cookie httpOnly, Secure, SameSite=Lax**, emitido pela API. Nunca ler nem gravar
  sessão no `localStorage`, e nunca expor o cookie ao JS do browser
- O servidor do frontend **encaminha o cookie** de sessão nas chamadas à API. Não há troca de code
  nem refresh de token OIDC a orquestrar: a sessão é resolvida no backend a cada request
- O perfil vem de `GET /me` — é o que decide navegação e permissões
- Proteja as rotas autenticadas no middleware/loader do framework, não só escondendo botões

## Variáveis de ambiente

```env
NEXT_PUBLIC_API_URL=http://localhost:3000   # URL do backend (e do auth server)
```
