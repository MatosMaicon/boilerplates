import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '@/config/env.schema';
import * as schema from '@/db/schema';

/**
 * Token de injeção do cliente Drizzle (tipado pelo schema completo).
 * Injete com `@Inject(DRIZZLE) private readonly db: Database`.
 */
export const DRIZZLE = Symbol('DRIZZLE');

/** Cliente Drizzle tipado — substitui o antigo `ExtendedPrismaClient`. */
export type Database = NodePgDatabase<typeof schema>;

/** Pool `pg` subjacente (exposto só para o ciclo de vida — não injetar em services). */
const PG_POOL = Symbol('PG_POOL');

/**
 * Módulo global de acesso a dados (Drizzle + node-postgres). Um único `Pool`
 * compartilhado por toda a aplicação; encerrado no shutdown do Nest.
 *
 * Driver `node-postgres`: mesmo driver para Neon (endpoint pooled), Postgres
 * local (Docker) e Testcontainers — sem atrito de proxy serverless.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: ConfigService<Env, true>) =>
        new Pool({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE,
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
      inject: [PG_POOL],
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Pool Postgres encerrado');
  }
}
