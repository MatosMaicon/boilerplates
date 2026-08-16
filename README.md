# Boilerplates

Catálogo de bases para projetos novos. Cada diretório é um boilerplate independente e
autocontido — com seu próprio `README.md`, `CLAUDE.md`, `.gitignore` e script de inicialização.

Não é um monorepo: nada aqui é compartilhado entre os boilerplates. Eles convivem no mesmo
repositório só para ficarem num lugar só, versionados juntos.

## O que tem aqui

| Boilerplate | Stack | Serve para |
|---|---|---|
| [`nest/`](nest/) | NestJS 11 · Drizzle ORM · Better Auth · PostgreSQL | API REST com autenticação própria, pronta para deploy em contêiner |

## Como começar um projeto

Copie o diretório do boilerplate para fora do repositório — como o `.git` fica na raiz daqui, a
cópia já sai limpa, sem histórico:

```bash
git clone git@github.com:MatosMaicon/boilerplates.git
cp -r boilerplates/nest ~/workspace/meu-projeto

cd ~/workspace/meu-projeto
./scripts/init.sh meu-projeto            # renomeia pacote, contêiner, banco, volume
git init && git add -A && git commit -m "chore: estrutura inicial"
```

Depois siga o `README.md` do boilerplate escolhido. Todos seguem o mesmo contrato:

- **`./scripts/init.sh <nome>`** renomeia os identificadores. Aceita `--dry-run`.
- **`./scripts/ci.sh`** é o gate de qualidade completo, rodando local.
- **`CLAUDE.md`** vem em duas camadas: *Produto* (com `<PREENCHER>`) e *Invariantes de engenharia*.
  Preencher a Camada 1 é o primeiro passo real do projeto — enquanto os `<PREENCHER>` estiverem
  lá, qualquer agente que ler o repositório trabalha às cegas.

## Adicionando um boilerplate novo

Um diretório por boilerplate, nomeado pela tecnologia principal (`nest`, `next`, `go`…). Para
entrar aqui, ele precisa de:

1. **`README.md` próprio** — o que já vem resolvido e como rodar
2. **`CLAUDE.md` em duas camadas** — produto separado de engenharia, senão o próximo projeto herda
   domínio alheio como se fosse regra técnica
3. **`scripts/init.sh`** — rename escopado a arquivos onde o nome é *identificador*, nunca `sed`
   cego no repositório (isso estragaria a prosa da documentação)
4. **`scripts/ci.sh`** — verificação que passa num clone limpo, sem depender de `.env` local
5. **ADRs em `docs/adr/`** — o *porquê* das escolhas, incluindo as consequências negativas

Commits usam o nome do boilerplate como escopo: `feat(nest): ...`, `fix(next): ...`.

## Princípio

Um boilerplate vale pelo que ele **evita redescobrir**, não pelo código que economiza. As linhas
mais valiosas de cada um aqui são os comentários que explicam a armadilha — a ordem de um
middleware, o campo que não cabe no tipo, a flag de install que parece supérflua e não é.

Por isso cada decisão não-óbvia tem ADR, e cada armadilha tem comentário no ponto exato do código
onde ela morde. Ao evoluir um boilerplate, mantenha esse padrão: se você levou uma hora para
entender algo, escreva onde a próxima pessoa vai tropeçar.
