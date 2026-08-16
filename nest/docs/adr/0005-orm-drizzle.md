# ADR 0005: ORM — Drizzle

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

O backend precisa de uma camada de acesso a dados tipada sobre PostgreSQL. Os candidatos práticos
no ecossistema Node são Prisma, Drizzle, TypeORM e SQL cru com um query builder fino.

O critério de desempate não foi performance — para a maioria dos projetos as três primeiras opções
são equivalentes na prática. Foi **onde vive o modelo de dados** e **quanto de indireção existe
entre o que você escreve e o SQL que sai**.

## Decisão

Adotar **Drizzle ORM** com o driver **`node-postgres` (`pg`)** e **drizzle-kit** para migrations.

- **Schema como TypeScript puro, sem codegen:** a "entity" é a definição da tabela e os tipos são
  *inferidos* (`$inferSelect`/`$inferInsert`). Não há passo de geração nem cliente gerado que possa
  ficar dessincronizado do schema.
- **Schema co-localizado no bounded context:** cada tabela vive no seu módulo
  (`modules/<contexto>/*.schema.ts`), reexportada por um barrel `src/db/schema.ts`. Fica perto do
  domínio, em vez de num arquivo único e distante.
- **Driver `node-postgres`:** o mesmo driver para o Postgres local (Docker), os testes
  (Testcontainers) e produção. Um único `Pool` compartilhado, exposto via DI pelo token `DRIZZLE`.
- **Migrations** geradas por `drizzle-kit generate` (SQL commitado em `drizzle/`) e aplicadas com
  `drizzle-kit migrate`. Nos testes de integração, aplicadas de verdade via `migrate()` no
  globalSetup.
- **Soft delete é manual.** O Drizzle não tem client extension global, então o filtro **não** é
  automático. O padrão fica centralizado em `common/database/soft-delete.ts`.

## Consequências

**Positivo:**
- Sem codegen: menos um passo no fluxo; tipos sempre em sincronia com o schema.
- Entities perto do domínio, menos "mágica" entre o código e o SQL.
- Mesmo driver em todos os ambientes — sem surpresa de proxy/serverless só em produção.

**Negativo:**
- ⚠️ **Soft delete manual é a maior fonte de erro desta decisão.** Esquecer um `notDeleted()` numa
  leitura devolve linhas excluídas sem nenhum aviso — não quebra teste, não quebra tipo. É por isso
  que o `apps/api/CLAUDE.md` insiste nisso e o módulo `example` demonstra o padrão em toda leitura.
- Menos ferramental de alto nível que o Prisma (o Studio é mais simples; não há motor de migração
  com detecção de drift tão elaborada).
- Reexportar a tabela nova no barrel é um passo manual fácil de esquecer — e o sintoma é uma
  migration vazia, não um erro.

## Alternativas consideradas

- **Prisma:** melhor DX de ferramental e migrations, mas o schema vive numa DSL própria e distante
  do domínio, e o cliente gerado é um passo de build a mais. O `$transaction` e o middleware de
  soft delete são melhores que os equivalentes do Drizzle — este é o ponto em que Prisma ganha.
- **TypeORM:** maduro e com decorators alinhados ao NestJS, mas a camada de abstração é espessa e o
  histórico de comportamento surpreendente em migrations pesa contra.
- **SQL cru + query builder fino (Kysely):** máximo controle e transparência, ao custo de escrever
  e manter as migrations à mão.

## Ponto de reavaliação

Se o soft delete manual gerar bugs recorrentes em produção, reavaliar: ou um wrapper de repositório
que force o filtro, ou views que já o apliquem, ou abandonar soft delete onde ele não paga o custo.
