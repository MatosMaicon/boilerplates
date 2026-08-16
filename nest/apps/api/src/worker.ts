import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * Entrypoint do worker (ADR 0004): processo separado da API, deployado como
 * outro serviço Railway. CONSOME as filas BullMQ — a API só enfileira.
 *
 * ⚠️ Commit 1: sobe o contexto de aplicação (DI + Drizzle) sem HTTP. Os
 * processors reais (video/email/indexing/notifications) entram junto com a
 * conexão BullMQ/Upstash. Quando isso acontecer, trocar AppModule por um
 * WorkerModule enxuto (sem controllers).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });

  // Mesmo logger estruturado da API: um só formato de log para os dois
  // serviços do Railway.
  app.useLogger(app.get(PinoLogger));
  const logger = app.get(PinoLogger);

  // Sem isto, um SIGTERM de deploy mata o processo no meio de um job e o pool
  // do Postgres não é encerrado.
  app.enableShutdownHooks();

  logger.log('Worker de pé — aguardando filas (nenhum processor registrado ainda).');
}

void bootstrap();
