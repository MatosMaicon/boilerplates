# Backend (NestJS)

> Leia também: [CLAUDE.md raiz](../../CLAUDE.md)

## Stack e versões

- **Runtime:** Node.js 24 · **Gerenciador:** npm (sem workspaces — ver ADR 0001)
- **Framework:** NestJS 11 (roda sobre **Express 5** — ver *Express 5* abaixo)
- **ORM:** Drizzle ORM (PostgreSQL, driver `node-postgres`) + drizzle-kit (migrations)
- **Auth:** Better Auth (biblioteca, dentro desta API) + Guards NestJS — ver ADR 0006
- **Validação de entrada:** class-validator + class-transformer (DTOs)
- **Validação de ambiente:** Zod (fail-fast no boot)
- **Contrato/Docs:** OpenAPI via `@nestjs/swagger` (fonte da verdade dos tipos)
- **Logging:** pino (JSON + correlation id)
- **Testes:** Vitest + Supertest; integração com Testcontainers

## Arquitetura

**Monólito modular pragmático** (ADR 0002). NestJS idiomático: um módulo por **bounded context** →
controller (fino, só roteamento/validação) → service (regra de negócio) → Drizzle (acesso a dados
direto no service). Introduzir uma classe `*.repository.ts` **só** onde a regra é rica o bastante
para justificar — não é camada obrigatória.

**Sem hexagonal e sem CQRS/event bus interno.** Coordenação entre contextos é chamada direta de
service dentro de uma transação Drizzle (`db.transaction(...)`). Se a coordenação ficar densa
demais, esse é o ponto a reavaliar — com um ADR novo.

**Um módulo por contexto, não por tela.** Telas são muitas e mudam; contextos são poucos e estáveis.

## Como rodar localmente

```bash
cd apps/api
cp .env.example .env        # preencher (validado por Zod no boot)
npm install --legacy-peer-deps   # a flag NÃO é opcional — ver abaixo
docker compose up -d        # Postgres (a auth roda dentro da API, não há IdP)
npm run db:migrate          # aplica as migrations
npm run db:seed             # (opcional) popula o módulo de exemplo — idempotente
npm run start:dev           # API (HTTP + OpenAPI em /docs)
npm run start:worker:dev    # worker — processo separado (ADR 0004)
```

API em `http://localhost:3000` · OpenAPI em `http://localhost:3000/docs`

Atalho: `./scripts/db-up.sh` sobe o Postgres, espera ficar *healthy*, migra e semeia.

> **`--legacy-peer-deps` no install — NÃO remova** (ver [ADR 0007](../../docs/adr/0007-lockfile-legacy-peer-deps.md)).
> O motivo não é conflito de resolução: o `better-auth` declara `vitest`, `vite` e `drizzle-kit`
> como peers **opcionais**. Resolvidos, eles entram na árvore como alcançáveis por uma dependência
> de **produção**, e aí `npm ci --omit=dev` passa a instalá-los no runtime — 75 MB de ferramenta de
> teste (e um advisory *critical*) dentro da imagem. **Gere o lockfile sempre com a flag.**

```bash
npm test                    # Vitest (unit)
npm run test:watch          # Vitest em watch
npm run test:int            # integração — Postgres efêmero via Testcontainers (exige Docker)
```

## Qualidade

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint (type-checked) — só verifica
npm run lint:fix     # ESLint corrigindo o auto-fixável
npm run format:check # Prettier — só verifica
npm run format       # Prettier escrevendo
```

O gate completo é `../../scripts/ci.sh`; `--fast` pula a integração. Rode antes de abrir PR.

- **ESLint** em `eslint.config.mjs` (flat config), `typescript-eslint` **`recommendedTypeChecked`**.
  As regras que usam o type-checker são o motivo da escolha: `no-floating-promises` e
  `no-misused-promises` pegam promise não-aguardada — a classe de bug mais comum aqui.
- **Prettier** cuida do layout; `eslint-config-prettier` (último na cadeia) desliga a sobreposição.
- Suprimir regra exige motivo: `// eslint-disable-next-line <regra> -- <motivo>`.
- `fromEntity` de DTO leva `this: void` na assinatura. É o que permite passá-lo desacoplado em
  `mapPaginated(page, Dto.fromEntity)` sem disparar `unbound-method` — mantenha em todo DTO novo.

### Dependências e `overrides`

O `package.json` não aceita comentário, então o porquê de cada `override` mora aqui:

| Override | Motivo |
|---|---|
| `@nestjs/swagger` → `js-yaml@^5.3.0` | O swagger pina `js-yaml@5.2.1`, com DoS por parsing exponencial (GHSA-pm4m-ph32-ghv5). Bump de minor, API compatível. **Remover quando o `@nestjs/swagger` subir sozinho.** |

Para medir o que realmente vai para produção — `npm audit` sozinho mistura devDependencies:

```bash
npm ci --omit=dev     # num clone limpo; o resumo do próprio ci audita o que instalou
```

## Estrutura de pastas

Dois entrypoints, um único codebase — deployados como **dois serviços** (ADR 0004).

```
apps/api/
├── drizzle/                 # migrations SQL geradas pelo drizzle-kit (commitadas) + meta/
├── drizzle.config.ts        # config do drizzle-kit
├── Dockerfile               # imagem única para os dois serviços
├── .dockerignore            # mantém .env e testes fora do contexto de build
├── eslint.config.mjs
├── scripts/                 # ergonomia local (db-up.sh, auth-session.sh)
├── test/integration/        # globalSetup do Testcontainers + injeção de env
└── src/
    ├── main.ts              # bootstrap da API (HTTP + OpenAPI)
    ├── worker.ts            # bootstrap do worker (consome filas)
    ├── app.module.ts
    ├── config/              # ConfigModule + env.schema.ts (Zod, fail-fast)
    ├── health/              # liveness + readiness
    ├── db/                  # barrel do schema + seed.ts
    ├── common/              # transversais — REUSE, não reinvente (ver abaixo)
    │   ├── auth/            # instância do Better Auth + AuthGuard global + @Public/@CurrentUser/@Roles
    │   ├── http/            # AllExceptionsFilter → application/problem+json (RFC 9457)
    │   ├── pagination/      # Paginated<T> + paginate() + PaginationQueryDto
    │   └── database/        # DatabaseModule (global) + DRIZZLE + helpers de soft delete
    ├── platform/            # infra transversal
    │   ├── logging/         # pino (JSON + correlation id) — API e worker
    │   └── queue/           # nomes das filas (stub — conecte o broker quando precisar)
    └── modules/             # um módulo por bounded context
        ├── identity/        # usuários, papéis, GET /me
        └── example/         # ⚠️ REFERÊNCIA — renomeie ou apague ao iniciar o projeto
```

> **Schema Drizzle:** as tabelas ficam **co-localizadas** no bounded context
> (ex.: `modules/example/item.schema.ts`) e o barrel `src/db/schema.ts` reexporta todas — o
> drizzle-kit e o cliente tipado consomem esse ponto único. Os tipos são **inferidos**
> (`$inferSelect`/`$inferInsert`), não há codegen.
>
> ⚠️ Esquecer de reexportar no barrel é o erro silencioso mais comum: compila, os testes de unidade
> passam, e o `db:generate` simplesmente não enxerga a tabela nova.

> **Testes co-localizados:** cada módulo agrupa seus testes em `__tests__/` — unit (`*.spec.ts`) e
> integração (`*.int-spec.ts`) juntos, ao lado do código que exercitam. Os globs do Vitest são
> recursivos, então não há config a mexer ao criar um `__tests__/` novo.

## Convenções NestJS

- Um módulo por **bounded context** (não por tela)
- Controllers apenas roteiam e validam entrada — a lógica vive nos Services
- **Services retornam entidades de domínio** (os tipos inferidos do Drizzle), **nunca DTOs.** O
  mapeamento entidade→DTO acontece no boundary (controller): `Dto.fromEntity(entity)` para recurso
  único e `mapPaginated(page, Dto.fromEntity)` para listas. Isso mantém a direção de dependência
  `apresentação → negócio → dados` e deixa o service reutilizável por outras projeções e pelo
  worker, sem arrastar o formato de resposta de um público só.
- **O input de service também não é DTO.** O service recebe um tipo de domínio **plano e sem
  decorators** (padrão *Query*/*Filter*, ex.: `ItemListQuery`), nunca o `*QueryDto`. O DTO de query
  **implementa** essa interface, então o controller passa o DTO como-está — sem mapeamento enquanto
  a query HTTP for 1:1 com a de domínio. A paginação vem do tipo plano `PageParams`.
- DTOs com class-validator para toda entrada; decore com `@nestjs/swagger` (alimentam o OpenAPI)
- `ValidationPipe` global com `whitelist: true` + `transform: true`
- Erros via exceções nativas do Nest — normalizadas em problem+json pelo filter global

**Referência viva:** o módulo `example` implementa exatamente esse padrão, com testes. Leia
`item.service.ts` + `item.controller.ts` antes de escrever o primeiro módulo de verdade.

## Express 5

O NestJS 11 roda sobre **Express 5 / path-to-regexp 8**. Duas mudanças mordem na prática:

- **Wildcard tem de ser nomeado.** O `*` anônimo deixou de ser path válido: `'/auth/*'` derruba o
  processo no boot com `Missing parameter name`. Use `'/auth/*splat'` (`splat` é só o nome do
  parâmetro). Vale para qualquer rota montada direto no Express; os paths dos controllers Nest
  (`@Controller('items')`, `@Get(':idOrSlug')`) não mudam.
- **Isso é erro de runtime, não de compilação.** O `tsc` e o lint passam com o wildcard velho, e os
  testes de integração usam `Test.createTestingModule` — que **não** executa o `main.ts`. Nenhum
  teste cobre a montagem. Depois de mexer no bootstrap, suba a API de verdade
  (`npm run start:dev`) e bata em `/health` e `/auth/ok` antes de confiar no CI verde.

## Transversais (`src/common/`) — reuse, não reinvente

Antes de escrever qualquer módulo novo, use o que já está pronto. **Não recrie** filtro de erro,
paginação, soft delete nem os decorators de auth — eles são globais e padronizam o contrato da API.

| Precisa de… | Use | Onde |
|---|---|---|
| Acesso a dados | `@Inject(DRIZZLE) private readonly db: Database` | `common/database/` (`DatabaseModule` é `@Global`) |
| Soft delete | **manual** (o Drizzle não tem extension global): `notDeleted(table.deletedAt)` no `where` de toda leitura e `softDelete(db, table).where(...)` na exclusão | `common/database/soft-delete.ts` |
| Listagem paginada | no DTO de query estenda `PaginationQueryDto`; o service recebe um filtro de domínio plano que estende `PageParams` e retorna `paginate(rows, total, query)`; o controller projeta com `mapPaginated(page, Dto.fromEntity)` | `common/pagination/` |
| Erro HTTP | lance exceção nativa do Nest (`NotFoundException`, etc.) — o `AllExceptionsFilter` emite problem+json | `common/http/` |
| Usuário autenticado | `@CurrentUser() user: AuthenticatedUser` | `common/auth/` |
| Rota sem auth | `@Public()` | `common/auth/public.decorator.ts` |
| Restrição por papel | `@Roles('user' \| 'admin')` | `common/auth/roles.ts` |

> Se algo transversal realmente novo for necessário, **adicione em `common/`** e documente aqui —
> não deixe a peça isolada dentro de um módulo.

## Contrato de API

- **Sucesso:** retorna o recurso **cru** (sem envelope). Listas usam o wrapper de paginação
  `{ items, page, pageSize, total }`.
- **Erro:** exception filter global emite `application/problem+json` (RFC 9457):
  `{ type, title, status, detail, instance }`. Nada de `{ data, error }`.
- **Paginação:** offset/página. Reavaliar cursor só se algum feed crescer muito.
- **Sem prefixo global** (`/items`, não `/api/items`) — o Better Auth serve `/auth/*` no mesmo nível.
- **Tipos no frontend:** o Nest emite OpenAPI e o frontend **gera** um cliente tipado por codegen.
  A API é a fonte única da verdade — não há pacote de tipos compartilhado (ADR 0001).

## Drizzle

- **Schema** co-localizado no módulo, reexportado pelo barrel `src/db/schema.ts`. TypeScript puro —
  sem DSL, sem codegen; tipos inferidos.
- **Migrations** geradas por `npm run db:generate` (drizzle-kit compara schema × snapshot) e
  aplicadas com `npm run db:migrate`. São **commitadas** e **não** editadas à mão — mudou o schema,
  gere de novo. `db:push` existe só para prototipagem local.
- **Cliente** injetado via DI: `@Inject(DRIZZLE) private readonly db: Database` — um único `Pool`.
- **Soft delete** não é automático. Use `notDeleted()` em TODA leitura de entidade de negócio e
  `softDelete()` na exclusão. ⚠️ **Escape hatch:** se o filtro gerar atrito real (relações, unique
  constraints), o requisito pode ser flexibilizado tabela a tabela — não é dogma.

## Autenticação

**Não há IdP externo** — o Better Auth roda como biblioteca dentro desta API (ADR 0006). A API é o
auth server e grava nas nossas próprias tabelas.

- **Montagem:** o handler é montado no Express em `main.ts` (`toNodeHandler`, rota `/auth/*splat`)
  **antes** dos body parsers — por isso `NestFactory.create` usa `bodyParser: false` e os parsers
  são registrados logo depois. Inverter essa ordem faz as requisições de auth pendurarem.
- **A Promise do `toNodeHandler` precisa de `.catch(next)`.** O Express descarta o retorno; sem
  isso, uma falha no auth vira `unhandledRejection` silenciosa e o request pendura até o timeout.
- **Instância única:** `common/auth/auth.provider.ts` monta o `betterAuth(...)` sobre o `Pool` que
  já existe (token `AUTH`, módulo `@Global` — sem segunda conexão).
- **Guard global** resolve a sessão via `auth.api.getSession()` (consulta ao mesmo Postgres, sem
  chamada de rede) e autoriza pelo `role`. Sessão ausente → 401; papel insuficiente → 403; conta
  com `deleted_at` preenchido → 401 (o Better Auth não conhece nosso soft delete).
- **Papéis NÃO são acumuláveis:** `users.role` é um enum único, não uma lista.
- **Trava de escalonamento:** todo campo privilegiado é declarado com `input: false` nos
  `additionalFields` — nenhum payload público de cadastro consegue setá-lo. Ao adicionar um campo
  ao usuário, declare a coluna no schema **e** o `additionalFields`; os dois lados precisam concordar.
- **`/auth/*` não entra no OpenAPI** (é servido fora do router do Nest). Documente à mão.
- Ergonomia local: `./scripts/auth-session.sh` cria/loga um usuário de teste e imprime o cookie.

## Segurança e limites de taxa

**Há DOIS limitadores, porque há duas pilhas de request:**

| Rotas | Limitador | Onde se configura |
|---|---|---|
| Rotas do Nest (`/items`, `/me`, …) | `@nestjs/throttler` (guard global) | `app.module.ts` — 120 req/min |
| `/auth/*` (login, cadastro, reset) | rate limit **do próprio Better Auth** | `common/auth/auth.provider.ts` |

⚠️ **O throttler NÃO cobre `/auth/*`.** É um guard do Nest, e o handler do Better Auth está montado
direto no Express, antes do router do Nest — guards nunca são executados nessas rotas. Justo as de
força bruta. Por isso o `rateLimit` do Better Auth é obrigatório, e não redundância.

- O rate limit do Better Auth usa `storage: 'database'` (tabela `rate_limits`), não o default
  `'memory'`: com 2+ réplicas, memória faz cada instância manter seu próprio balde — o limite
  efetivo vira N× o configurado e todo restart zera os contadores.
- **`trust proxy`** é ligado só em produção (`main.ts`). Sem ele, atrás de um proxy o Express
  enxerga o mesmo IP em todo request e os DOIS limitadores passam a contar o mundo inteiro num
  balde só. Fora de produção fica desligado de propósito: confiar cegamente no `X-Forwarded-For`
  permitiria forjar o IP e escapar do limite. **Ajuste o número de hops** conforme sua plataforma.
- **helmet** é registrado **antes** do mount do Better Auth. O handler de auth responde sem chamar
  `next()`, então middleware registrado depois dele não roda para `/auth/*`.
- A CSP padrão do helmet quebra o Swagger UI (scripts inline). Em vez de afrouxar a API inteira,
  `main.ts` aplica uma CSP relaxada **apenas** em `/docs`.

## Observabilidade

- **Logging estruturado com pino** (`platform/logging/`), o mesmo para API e worker. Em produção
  sai JSON de uma linha por request; em dev, `pino-pretty`.
- **Correlation id:** toda linha de um request carrega o mesmo `reqId`, devolvido no header
  `x-request-id`. Se o header já vier, é reaproveitado — dá para pegar o id de um erro relatado
  pelo front e puxar o request exato no log.
- **Cookie e `authorization` são redigidos** (`redact`). Sem isso o token de sessão iria para o log
  em texto claro a cada request autenticado.
- ⚠️ O `pino-pretty` roda em worker thread e pode não dar flush nas últimas linhas ao encerrar — em
  dev, logs de shutdown às vezes somem. Não é o hook falhando; rode com `NODE_ENV=production`.
- **Health checks — liveness e readiness são perguntas diferentes:**

  | Rota | Pergunta | Reação da plataforma se falhar |
  |---|---|---|
  | `GET /health` | o processo responde? | **reinicia** o contêiner |
  | `GET /health/ready` | dá para mandar tráfego? | só **para de rotear** |

  Por isso `/health` **não** toca no banco: apontar o healthcheck de liveness para o Postgres
  transforma uma indisponibilidade do banco em crash loop.

## Deploy

Uma **imagem única** (`Dockerfile`) para os dois serviços da ADR 0004 — muda só o comando:

| Serviço | Start command | Healthcheck |
|---|---|---|
| `api` | `node dist/main` (default do `CMD`) | `GET /health/ready` |
| `worker` | `node dist/worker` | nenhum (não abre porta HTTP) |

```bash
docker build -t api .                     # a partir de apps/api
docker run --rm -p 3000:3000 --env-file .env api
```

- **Build multi-stage:** o estágio de build instala tudo; o runtime roda
  `npm ci --omit=dev --legacy-peer-deps` (ADR 0007) e copia só o `dist`.
- **`tini` como PID 1:** repassa o SIGTERM ao Node e recolhe zumbis. Sem isso o
  `enableShutdownHooks()` pode nunca rodar num deploy e o pool fica pendurado.
- Roda como usuário **`node`**, não root. O `.dockerignore` mantém `.env` fora do contexto — um
  `.env` copiado fica gravado na camada para sempre, mesmo que um `RUN` posterior o apague.
- **Migrations NÃO rodam no contêiner.** O `drizzle-kit` é devDependency e não está na imagem.
  Aplique do seu ambiente **antes** de subir o deploy (`npm run db:migrate`). Ordem importa:
  migration primeiro, deploy depois — senão o código novo encontra schema velho.

## Configuração e ambiente

- `ConfigModule` global; o `.env` é validado por **Zod** no boot (`config/env.schema.ts`).
  Falta de variável obrigatória **derruba o start** — fail-fast, sem defaults silenciosos.
- ⚠️ Ao tornar uma variável obrigatória, injete um valor de teste em
  `test/integration/setup-env.ts`. Senão a suíte de integração passa na sua máquina (que tem
  `.env`) e quebra num clone limpo.
- Nunca commitar `.env*` com valores reais; manter `.env.example` atualizado.

## Testes

- **Vitest** (unit + integração) + **Supertest** para e2e de API (bate no app Nest em memória).
- **Co-localização:** testes de cada módulo em `__tests__/` dentro do próprio módulo.
  `*.spec.ts` = unit, `*.int-spec.ts` = integração.
- Integração usa **Testcontainers** (Postgres real e efêmero por run; aplica as migrations de
  verdade no globalSetup), para cobrir features do Postgres que um mock não pega: `TEXT[]`, enums
  nativos, unique + soft delete.
- Os fakes de Drizzle nos testes de unidade são **fakes, não mocks de asserção**: verificam o
  resultado do service, não quais métodos do query builder ele chamou. Acoplar o teste à forma da
  query engessa refatoração — quem cobre o SQL é o teste de integração.
