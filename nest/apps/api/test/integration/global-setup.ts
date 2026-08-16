import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { GlobalSetupContext } from 'vitest/node';

/**
 * globalSetup dos testes de integração (ADR 0003 / decisão Testcontainers).
 *
 * Sobe um Postgres real e efêmero, aplica as migrations do Drizzle (pasta
 * `./drizzle`, geradas por `npm run db:generate`) e publica a connection string
 * para os specs via `provide`. Rodar as migrations de verdade dá fidelidade ao
 * histórico e cobre features do Postgres que um mock não pega (TEXT[], enums…).
 *
 * ⚠️ Requer Docker. Sem Docker, rode só os testes unitários (`npm test`).
 */
let container: StartedPostgreSqlContainer;

export default async function setup({ provide }: GlobalSetupContext) {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();

  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  await pool.end();

  provide('databaseUrl', url);

  return async () => {
    await container.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
