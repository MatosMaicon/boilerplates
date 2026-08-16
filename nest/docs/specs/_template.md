# Spec: [Nome da Feature]

**Status:** Rascunho | Em revisão | Aprovado | Implementado
**Data:** YYYY-MM-DD
**Autor:** 

## Problema

O que está sendo resolvido? Por que isso é necessário?

## Solução proposta

Descrição de alto nível do que será implementado.

## Escopo

### Incluído
- 

### Excluído (fora do escopo)
- 

## Requisitos funcionais

- [ ] RF01: 
- [ ] RF02: 

## Requisitos não-funcionais

- [ ] Performance: 
- [ ] Segurança: 

## API (backend)

Endpoints que serão criados ou modificados.

```
POST /recurso
GET  /recurso/:id
```

## UI (frontend)

Telas/componentes que serão criados ou modificados. Pode incluir wireframes ou descrições.

## Modelo de dados

> **Convenção global:** toda entidade de negócio tem `created_at`, `updated_at` e `deleted_at` (soft delete). Ver `apps/api/CLAUDE.md § Transversais`. ⚠️ O soft delete NÃO é automático — use `notDeleted()` em toda leitura.

Tabelas ou campos novos no banco de dados (listando apenas colunas específicas desta feature — as três colunas globais são implícitas).

## Integrações externas

Serviços externos envolvidos. Declare cada variável nova em `apps/api/src/config/env.schema.ts` — variável que existe só no `.env` não é validada e falha tarde.

## Critérios de aceitação

- [ ] 
- [ ] 
