# ADR 0007: Lockfile do `apps/api` gerado com `--legacy-peer-deps`

**Status:** Aceito
**Data:** 2026-08-16

> Não supera nenhum ADR anterior. Complementa a [ADR 0004](0004-topologia-worker.md) (topologia de
> deploy) fixando o que a imagem de produção pode conter.

## Contexto

O `better-auth` declara como **peer dependencies opcionais** um conjunto de integrações que ele
suporta mas não exige — entre elas `vitest`, `vite` e `drizzle-kit`, além de `pg`, `drizzle-orm`,
`react`, `next` e outras. Todas marcadas com `peerDependenciesMeta.optional = true`.

Três dessas (`vitest`, `vite`, `drizzle-kit`) também estão nas nossas **devDependencies**, porque
são a nossa ferramenta de teste e de migration. Quando o npm resolve os peers, ele satisfaz o peer
opcional do `better-auth` com o pacote que já está instalado — e passa a registrar no lockfile que
essas ferramentas são alcançáveis a partir de uma dependência de **produção**.

A consequência aparece no deploy, não no desenvolvimento: `npm ci --omit=dev` deixa de omiti-las,
porque do ponto de vista do lockfile elas não são mais só devDependencies.

Medido com `@nestjs/*@11` e `better-auth@1.6.29`:

| `npm ci --omit=dev` num clone limpo | lockfile sem a flag | lockfile com `--legacy-peer-deps` |
|---|---|---|
| Tamanho do `node_modules` | 224 MB | **149 MB** |
| `vitest` · `vite` · `esbuild` · `drizzle-kit` | instalados | **ausentes** |
| `pg` · `drizzle-orm` · `better-auth` · `@nestjs/core` | instalados | instalados |
| Vulnerabilidades na árvore instalada | 18 (1 *critical*) | **0** |

A *critical* é do próprio `vitest`; a moderate mais relevante é o `esbuild` (servidor de
desenvolvimento acessível por qualquer site). Nenhuma das duas tem por que existir num contêiner
que só serve HTTP em produção.

`--omit=peer` **não** resolve: o `npm ci` instala exatamente o que o lockfile descreve, então a
decisão já foi tomada no momento em que o lockfile foi gerado.

Havia ainda um motivo histórico para a flag — um conflito real de resolução entre um peer do
`better-auth` que exigia `vite>=6` e o `vite@5` do tree de testes. Esse conflito **não existe
mais**: hoje a resolução limpa completa sem erro. Se o motivo fosse só esse, a flag já poderia ter
sido removida, e é exatamente por isso que este ADR existe.

## Decisão

**O lockfile do `apps/api` é gerado e atualizado sempre com `--legacy-peer-deps`.**

```bash
npm install --legacy-peer-deps            # instalar / adicionar dependência
rm package-lock.json && npm install --legacy-peer-deps   # regenerar do zero
```

- A flag faz o npm **ignorar peer dependencies** na resolução. Como todos os peers relevantes do
  `better-auth` são opcionais e nós não usamos nenhuma dessas integrações, ignorá-los não perde
  nada — só evita que o dev tooling seja promovido à árvore de produção.
- As dependências de produção de verdade (`pg`, `drizzle-orm`) estão declaradas **explicitamente**
  nas nossas `dependencies`, então não dependem da resolução de peer para existir.
- **Verificação canônica** do que vai para produção — `npm audit` sozinho mistura devDependencies
  e não responde a pergunta certa:

  ```bash
  npm ci --omit=dev     # num clone limpo; o resumo do próprio ci audita o que instalou
  ```

- O Dockerfile do serviço (`api` e `worker`) instala com `npm ci --omit=dev` sobre este lockfile.

## Consequências

**Positivo:**
- Imagem de produção 33% menor (149 MB vs 224 MB de `node_modules`).
- Zero vulnerabilidades na árvore que efetivamente roda .
- Nenhuma ferramenta de teste ou de build presente em runtime — reduz a superfície de ataque
  independentemente de advisory conhecido.

**Negativo:**
- O comando de install **não é o padrão**, e um `npm install` distraído regenera o lockfile do jeito
  errado, em silêncio. É a fragilidade central desta decisão — daí o registro aqui e a nota em
  `apps/api/CLAUDE.md`.
- Peers legítimos deixam de ser verificados pelo npm. Na prática o risco é baixo (o TypeScript e os
  testes pegariam uma incompatibilidade real), mas é uma rede de proteção a menos.
- A flag some do radar quando o motivo histórico for esquecido. Este ADR é a mitigação.

## Alternativas consideradas

- **`npm ci --omit=dev --omit=peer` no Dockerfile:** testado, **não funciona**. O `npm ci` reproduz
  o lockfile literalmente; a flag não altera o que já está descrito nele.
- **Mover `vitest`/`drizzle-kit` para fora do `apps/api`** (um pacote de tooling separado): elimina
  a sobreposição com os peers do `better-auth`, mas exige workspaces — descartado pela
  [ADR 0001](0001-monorepo-estrutura.md), que optou por monorepo sem tooling.
- **`overrides` para neutralizar os peers:** `overrides` atua em versão, não em alcançabilidade;
  não remove o pacote da árvore de produção.
- **Aceitar a árvore maior e tratar os advisories caso a caso:** descartado. O custo recorrente de
  triar advisories de ferramenta que nem deveria estar na imagem é maior que o de manter a flag
  documentada.
- **Multi-stage build descartando `node_modules` de dev:** ainda seria necessário um install de
  produção correto no estágio final — é complementar a esta decisão, não substituto.
