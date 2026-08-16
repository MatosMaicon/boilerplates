# Boilerplate — NestJS + Drizzle + Better Auth

> Base para projetos novos: backend NestJS pronto para produção, convenções documentadas e um
> ambiente de agente configurado. Feito para ser clonado e renomeado, não lido e copiado.

## O que já vem resolvido

| | |
|---|---|
| **API** | NestJS 11 (Express 5), OpenAPI em `/docs`, contrato `problem+json` (RFC 9457) |
| **Banco** | Drizzle ORM + drizzle-kit, migrations commitadas, soft delete com helpers |
| **Auth** | Better Auth como biblioteca dentro da API — sem IdP externo, sessão em cookie httpOnly |
| **Segurança** | helmet, rate limit em duas camadas (Nest + Better Auth), `trust proxy`, papéis |
| **Observabilidade** | pino com correlation id, liveness e readiness separados |
| **Deploy** | Dockerfile multi-stage, imagem única para API e worker, `tini`, usuário não-root |
| **Qualidade** | ESLint type-checked, Prettier, Vitest, Testcontainers, `scripts/ci.sh` |
| **Agentes** | `CLAUDE.md` em duas camadas, skills, ADRs, templates de spec |

Um módulo de exemplo (`apps/api/src/modules/example`) implementa os padrões de ponta a ponta, com
testes de unidade e de integração — é a referência viva, não um "hello world".

## Começando um projeto novo

```bash
git clone <este-repo> meu-projeto && cd meu-projeto
./scripts/init.sh meu-projeto          # renomeia o boilerplate (rode UMA vez)

cd apps/api
cp .env.example .env                   # gere o BETTER_AUTH_SECRET conforme instruído no arquivo
npm install --legacy-peer-deps         # a flag NÃO é opcional — ver ADR 0007
docker compose up -d                   # Postgres local
npm run db:migrate && npm run db:seed
npm run start:dev                      # http://localhost:3000 · OpenAPI em /docs
```

Depois: preencha a **Camada 1** do [`CLAUDE.md`](CLAUDE.md) e decida o que fazer com o módulo
`example` (renomear para o seu primeiro contexto, ou apagar).

Requisitos: **Node.js 24** e **Docker** (Postgres local e testes de integração).

## Verificação

Não há CI em runner remoto — o gate roda na máquina:

```bash
./scripts/ci.sh            # typecheck + lint + formatação + unit + integração
./scripts/ci.sh --fast     # pula a integração (não precisa de Docker)
```

## Decisões

Os ADRs em [`docs/adr/`](docs/adr/) explicam **por que** a base é como é — leia antes de contrariar:

| ADR | Decisão |
|---|---|
| [0001](docs/adr/0001-monorepo-estrutura.md) | Monorepo simples, sem tooling |
| [0002](docs/adr/0002-arquitetura-backend.md) | Monólito modular pragmático |
| [0003](docs/adr/0003-contrato-api.md) | Data crua + `problem+json` + OpenAPI |
| [0004](docs/adr/0004-topologia-worker.md) | API produz, worker consome |
| [0005](docs/adr/0005-orm-drizzle.md) | Drizzle ORM |
| [0006](docs/adr/0006-auth-better-auth.md) | Better Auth dentro da API |
| [0007](docs/adr/0007-lockfile-legacy-peer-deps.md) | Lockfile com `--legacy-peer-deps` |

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — base de conhecimento (Camada 1: produto · Camada 2: engenharia)
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — convenções, padrões e **armadilhas concretas**
- [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) — convenções do frontend (sem código ainda)
- [`docs/specs/`](docs/specs/) · [`docs/agents/`](docs/agents/)

## O que este boilerplate NÃO decide

Storage, pagamento, e-mail, busca e IA ficaram de fora de propósito — cada projeto declara o que
realmente usa. O `env.schema.ts` valida só o núcleo; acrescente as suas integrações lá **na mesma
hora** em que as adicionar ao `.env`, senão elas falham tarde em vez de no boot.
