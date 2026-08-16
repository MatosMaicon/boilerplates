# ADR 0004: Topologia de Deploy — API Produz, Worker Consome

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

Quase todo backend acaba com trabalho assíncrono: envio de e-mail, processamento de arquivo,
indexação, notificação, relatório. A pergunta é se esses processors rodam no mesmo processo da API
ou num processo separado — e é melhor decidir antes de existir o primeiro job, porque mudar depois
significa mexer no deploy.

O risco de rodar junto não é teórico: um job pesado de CPU (transcodificação, geração de PDF,
processamento de imagem) bloqueia o event loop e trava o request/response da API.

## Decisão

**Dois entrypoints, um único codebase:**

- `src/main.ts` — bootstrap da API (HTTP + OpenAPI). **Só enfileira** jobs.
- `src/worker.ts` — bootstrap do worker. **Consome** as filas.
- Deploy como **dois serviços** a partir do mesmo repositório e da **mesma imagem Docker** —
  o que muda é só o comando (`node dist/main` vs. `node dist/worker`).
- A escolha de quais filas um worker registra é **config-driven**: uma fila pesada pode ser isolada
  num terceiro serviço depois, sem refactor.

> ⚠️ O boilerplate entrega o **seam**, não o broker. `platform/queue/` tem só os nomes das filas, e
> o `worker.ts` sobe um contexto de aplicação sem processors. Conecte o broker (BullMQ/Redis ou
> outro) quando houver o primeiro job de verdade. **Se o projeto não tiver trabalho assíncrono,
> apague `worker.ts` e `platform/queue/`** — é mais honesto que manter um serviço vazio de pé.

## Consequências

**Positivo:**
- Trabalho pesado de CPU não compete com o request/response da API.
- API e worker escalam de forma independente.
- Um único codebase — módulos e o cliente de dados (Drizzle) compartilhados entre os dois
  entrypoints, sem duplicação.
- Uma imagem só para construir, testar e versionar.

**Negativo:**
- Dois serviços para configurar e observar (logs, métricas, deploy) em vez de um.
- Custo de um serviço worker sempre de pé, mesmo com fila vazia.
- O `worker.ts` importa hoje o `AppModule` inteiro, então carrega controllers que não usa. Quando
  os processors reais entrarem, troque por um `WorkerModule` enxuto.

## Alternativas consideradas

- **Processo único (API + processors juntos):** mais simples e barato, mas um job pesado trava
  requisições — o problema que esta decisão existe para evitar.
- **Serverless/cron externo para os jobs:** escala a zero, mas fragmenta o codebase e complica o
  acesso ao banco e às migrations.
- **Imagens separadas para API e worker:** isolamento marginalmente maior, ao custo de dois builds
  e duas superfícies para manter em sincronia.

## Ponto de reavaliação

Se uma fila específica dominar o consumo de CPU, isolá-la num serviço worker dedicado — já previsto
como config-driven, sem refactor.
