# <NOME DO PROJETO> — Base de Conhecimento

> Este arquivo tem **duas camadas**, e elas envelhecem em velocidades diferentes:
>
> - **Camada 1 — Produto.** É sua. Preencha os `<PREENCHER>` no início do projeto e mantenha
>   atualizada conforme o produto muda.
> - **Camada 2 — Invariantes de engenharia.** Vem do boilerplate e vale para qualquer projeto
>   sobre esta base. Só mexa aqui com um motivo, e registrando o motivo (ADR).
>
> Misturar as duas é o que faz um boilerplate apodrecer: no projeto seguinte alguém herda
> "comissão de 50%" como se fosse regra de engenharia.

---

# CAMADA 1 — PRODUTO (preencha)

## O que é este projeto

<PREENCHER: dois parágrafos. O que o produto faz, para quem, e qual problema resolve.
Escreva para alguém — humano ou agente — que nunca ouviu falar dele.>

## Visão do produto

<PREENCHER: uma frase de posicionamento. "Para <público> que <necessidade>, o <produto> é um
<categoria> que <benefício>. Diferente de <alternativa>, ele <diferencial>.">

## Stack

O núcleo vem do boilerplate. As linhas em branco são as decisões deste projeto.

| Camada | Tecnologia | Hospedagem |
|--------|-----------|------------|
| Backend | NestJS 11 + Drizzle ORM | <PREENCHER> |
| Banco | PostgreSQL | <PREENCHER> |
| Auth | Better Auth (biblioteca, dentro da API) + Guards NestJS | a própria API |
| Frontend | <PREENCHER — o `apps/web` só tem convenções, sem código> | <PREENCHER> |
| Fila / Worker | <PREENCHER ou remova — ver ADR 0004> | |
| Storage | <PREENCHER ou remova> | |
| E-mail | <PREENCHER ou remova> | |

## Bounded contexts

Um módulo por **contexto de domínio**, não por tela. Comece pequeno: é mais fácil dividir um
módulo grande depois do que juntar cinco pequenos que nasceram errados.

| Módulo | Cobre |
|--------|-------|
| `identity` | usuários, papéis, autenticação (vem do boilerplate) |
| `example` | ⚠️ módulo de referência — renomeie para o seu primeiro contexto ou apague |
| <PREENCHER> | |

## Glossário

<PREENCHER, ou deixe o `/grill-with-docs` criar sob demanda. Ver `docs/agents/domain.md`.>

---

# CAMADA 2 — INVARIANTES DE ENGENHARIA (do boilerplate)

## Estrutura do repositório

```
.
├── apps/
│   ├── api/          # Backend — NestJS. Tem seu próprio CLAUDE.md (leia antes de codar).
│   └── web/          # Frontend — SÓ convenções por ora, sem código.
├── docs/
│   ├── adr/          # Architecture Decision Records (_template.md incluso)
│   ├── specs/        # Especificações de features (_template.md incluso)
│   └── agents/       # Como as agent skills consomem este repo
├── scripts/
│   ├── ci.sh         # Gate de qualidade — roda local, não há runner remoto
│   └── init.sh       # Renomeia o boilerplate para o seu projeto (rode UMA vez)
├── .devcontainer/    # Sandbox com firewall de saída — leia o devcontainer.json
├── .claude/          # settings.json (versionado) + skills/
├── .scratch/         # Rascunhos, PRDs e issues locais. NÃO versionado.
└── CLAUDE.md         # Este arquivo
```

## Convenções globais

- Idioma do código: **inglês** (variáveis, funções, classes, tipos)
- Idioma da documentação e dos commits: **português**
- Commits: `tipo(escopo): descrição` — ex.: `feat(api): adiciona listagem de itens`
- Tipos válidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`
- Nunca commitar `.env*` com valores reais; manter `.env.example` atualizado

## Fluxo de trabalho

Feature nova nasce como **spec** em `docs/specs/` (use o `_template.md`) e só depois vira código.
A cadeia de skills abaixo é o caminho assistido dessa mesma ideia:

```
/grill-with-docs   ← entende e refina a ideia (produz CONTEXT.md/ADR quando algo é resolvido)
      ↓
/to-prd            ← escreve o PRD em .scratch/
      ↓
/to-issues         ← quebra em issues (.scratch/<feature-slug>/)
      ↓
/triage            ← classifica cada issue
      ↓
/tdd               ← implementa
```

Antes de abrir PR: `./scripts/ci.sh` verde, e descrição referenciando a spec.

## Qualidade

Não há CI em runner remoto — **este script é o CI**:

```bash
./scripts/ci.sh            # typecheck + lint + format:check + unit + integração
./scripts/ci.sh --fast     # pula a integração (não precisa de Docker)
```

- **ESLint** com `typescript-eslint` no nível **type-checked**. As regras que dependem de tipo
  (`no-floating-promises`, `no-misused-promises`) são o motivo da escolha — promise não-aguardada
  é a classe de bug mais comum em código Nest.
- **Prettier** para formatação. Correção é do ESLint, layout é do Prettier.
- **Markdown fica fora do Prettier** de propósito (repagina tabelas e gera diff enorme);
  o `.editorconfig` cobre encoding, fim de linha e espaço à direita.
- Suprimir uma regra é legítimo com motivo escrito:
  `// eslint-disable-next-line <regra> -- <motivo>`. Sem justificativa não passa em review.

## Decisões arquiteturais

Os ADRs em `docs/adr/` explicam **por que** a base é como é. Leia antes de contrariar qualquer um:

| ADR | Decisão |
|---|---|
| [0001](docs/adr/0001-monorepo-estrutura.md) | Monorepo simples, sem tooling (`apps/api`, `apps/web`) |
| [0002](docs/adr/0002-arquitetura-backend.md) | Monólito modular pragmático — sem hexagonal, sem CQRS |
| [0003](docs/adr/0003-contrato-api.md) | Data crua + `problem+json` (RFC 9457) + OpenAPI |
| [0004](docs/adr/0004-topologia-worker.md) | Dois entrypoints: API produz, worker consome |
| [0005](docs/adr/0005-orm-drizzle.md) | Drizzle ORM + drizzle-kit |
| [0006](docs/adr/0006-auth-better-auth.md) | Better Auth como biblioteca dentro da API |
| [0007](docs/adr/0007-lockfile-legacy-peer-deps.md) | Lockfile gerado com `--legacy-peer-deps` |

Mudou de ideia? **Escreva um ADR novo que supera o antigo** — não edite o antigo. O histórico da
decisão vale tanto quanto a decisão.

## Como navegar

- Backend: abra `apps/api/` e leia `apps/api/CLAUDE.md` — é lá que estão as convenções e as
  armadilhas concretas (Express 5, ordem do helmet, soft delete manual)
- Frontend: `apps/web/CLAUDE.md`
- Uma feature específica: leia `docs/specs/<feature>.md` antes de implementar

## Agent skills

As skills vivem em `.claude/skills/` (fonte única — instaladas de `mattpocock/skills`, rastreadas
pelo `skills-lock.json`). Não duplique o diretório em `.agents/`: as duas cópias divergem.

### Issue tracker

Issues vivem como markdown local em `.scratch/<feature-slug>/`. Ver `docs/agents/issue-tracker.md`.
⚠️ `.scratch/` **não é versionado** — as issues são locais a esta máquina.

### Triage labels

Strings canônicas: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
Ver `docs/agents/triage-labels.md`.

### Domain docs

O layout previsto é `CONTEXT-MAP.md` na raiz apontando para `apps/api/CONTEXT.md` e
`apps/web/CONTEXT.md`; ADRs de sistema em `docs/adr/`.

⚠️ **Esses `CONTEXT.md` não existem, e isso é esperado** — são criados sob demanda pelo
`/grill-with-docs` quando um termo de domínio realmente é resolvido. Não os crie preventivamente
e não sinalize a ausência. Ver `docs/agents/domain.md`.
