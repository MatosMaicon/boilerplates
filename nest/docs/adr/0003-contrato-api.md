# ADR 0003: Contrato da API — Data Crua + problem+json + OpenAPI

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

O formato de resposta e de erro é um contrato: uma vez que um cliente depende dele, mudar depois é
caro. Vale decidir no dia zero, não na terceira feature.

Junto disso, é preciso decidir como o frontend obtém os tipos da API sem reabrir o
[ADR 0001](0001-monorepo-estrutura.md), que evitou tooling de monorepo/workspaces.

## Decisão

**Formato de resposta:**

- **Sucesso:** retorna o recurso **cru**, sem envelope. O status HTTP carrega o significado.
- **Listas:** wrapper de paginação `{ items, page, pageSize, total }` (offset/página).
- **Erro:** exception filter global emite `application/problem+json` (RFC 9457):
  `{ type, title, status, detail, instance }`. Sem `{ data, error }`.
- **Sem prefixo global de rota** (`/items`, não `/api/items`): o Better Auth serve `/auth/*` no
  mesmo nível, e um prefixo só no lado do Nest deixaria o contrato inconsistente.

**Tipos no frontend:**

- O Nest emite **OpenAPI** via `@nestjs/swagger` (DTOs decorados) — fonte única da verdade.
- O frontend **gera** um cliente tipado por codegen a partir do OpenAPI.
- **Não** há pacote de tipos compartilhado — coerente com o ADR 0001.

## Consequências

**Positivo:**
- Contrato limpo e RESTful; casa com clientes tipados e ferramentas OpenAPI.
- Swagger UI (`/docs`) de brinde para exploração e QA.
- Front sempre tipado contra a API sem acoplar a ordem de build entre os apps.

**Negativo:**
- Erros em problem+json exigem que o front trate um formato específico.
- Codegen é um passo extra no fluxo do frontend (precisa rodar quando o contrato muda).
- Paginação offset pode não escalar para feeds grandes (ver ponto de reavaliação).
- ⚠️ **As rotas `/auth/*` ficam fora do OpenAPI** — são servidas fora do router do Nest (ADR 0006).
  É uma exceção consciente a este ADR, e o contrato delas precisa ser documentado à mão.

## Alternativas consideradas

- **Envelope global `{ data, meta, error }` via interceptor:** consistente, mas o cliente tipado
  sempre desembrulha `.data` e o status HTTP vira redundante com o corpo.
- **Pacote compartilhado de contratos (zod/ts-rest):** segurança de tipo end-to-end, mas reabre o
  ADR 0001 (workspaces) e acopla a ordem de build.
- **Sem compartilhamento de tipos:** front escreve tipos à mão — divergem silenciosamente até
  quebrar em runtime.

## Ponto de reavaliação

Paginação por cursor, se algum feed crescer a ponto de o offset pesar.
