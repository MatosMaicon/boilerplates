# ADR 0001: Estrutura de Monorepo

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

O projeto tem um backend e um frontend que precisam coexistir no mesmo repositório para facilitar o
desenvolvimento, mas devem ser deployados e escalados de forma independente.

A tentação é adotar tooling de monorepo (Turborepo, Nx, workspaces do npm) desde o início. O custo
não é o setup — é que workspaces mudam a resolução de dependências, o formato do lockfile e o
comportamento do `npm ci`, e isso passa a valer para todo projeto derivado desta base.

## Decisão

Monorepo **simples**, com uma pasta `apps/` contendo `api/` e `web/`, **sem tooling de monorepo e
sem workspaces**.

```
apps/
├── api/   → backend
└── web/   → frontend
```

- Cada app tem seu próprio `package.json`, `node_modules` e lockfile.
- Cada app é instalado e buildado a partir do seu próprio diretório.
- Compartilhamento de tipos entre back e front acontece por **codegen do OpenAPI**
  ([ADR 0003](0003-contrato-api.md)), não por pacote compartilhado.

## Consequências

**Positivo:**
- Contexto unificado para desenvolvimento — um clone, um histórico, um `CLAUDE.md` raiz.
- Nenhuma mágica de resolução: `npm ci` dentro de `apps/api` faz exatamente o que aparenta.
  Isso importa mais do que parece — ver [ADR 0007](0007-lockfile-legacy-peer-deps.md), onde a
  estratégia de resolução do npm determina o que entra na imagem de produção.
- Deploy de cada app é configurado independentemente.

**Negativo:**
- Sem cache de build compartilhado entre apps.
- Dependência comum é instalada duas vezes (uma por app) — custo de disco, não de correção.
- Se um dia houver código genuinamente compartilhado (não só tipos), não há lugar natural para ele
  sem reabrir esta decisão.

## Alternativas consideradas

- **Repositórios separados:** isolamento total, mas atrito alto no início e nenhum lugar único para
  a documentação de arquitetura.
- **npm workspaces:** instalação única e hoisting, mas muda a resolução e o lockfile — e é
  exatamente o tipo de mudança global que um boilerplate não deve impor.
- **Turborepo/Nx desde o início:** cache e orquestração de tarefas, complexidade desnecessária para
  dois apps.

## Ponto de reavaliação

Quando surgir código compartilhado de verdade entre os apps (não tipos — esses vêm do OpenAPI), ou
quando o tempo de build começar a doer. Aí sim, workspaces ou Turborepo, com um ADR novo — e
revisando o ADR 0007 junto, porque a estratégia de resolução muda.
