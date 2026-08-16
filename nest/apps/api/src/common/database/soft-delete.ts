import { isNull, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { Database } from './database.module';

/**
 * Soft delete (convenção global — ver apps/api/CLAUDE.md § Transversais).
 *
 * ⚠️ Diferença do Prisma: o Drizzle NÃO tem client extension global, então o
 * soft delete não é automático. Estes dois helpers centralizam o padrão para não
 * espalhar `isNull(deletedAt)` cru pelos services:
 *
 *  - `notDeleted(table.deletedAt)` → condição de linha viva; combine com `and(...)`
 *    em TODA leitura de entidade de negócio.
 *  - `softDelete(db, table).where(...)` → converte a exclusão em
 *    `UPDATE deleted_at = now()`. Não use `db.delete()` em entidade de negócio.
 *
 * Escape hatch: se o filtro gerar atrito com relações/unique numa
 * tabela, o requisito pode ser relaxado ali — não é dogma.
 */

/** Condição "linha não excluída" (`deleted_at IS NULL`) para o `where`. */
export function notDeleted(deletedAt: AnyPgColumn): SQL {
  return isNull(deletedAt);
}

type SoftDeletable = PgTable & { deletedAt: AnyPgColumn };

/**
 * Marca linhas como excluídas em vez de removê-las fisicamente. Encadeie o
 * `.where(...)`: `await softDelete(db, content).where(eq(content.id, id))`.
 */
export function softDelete<T extends SoftDeletable>(db: Database, table: T) {
  return db.update(table).set({ deletedAt: new Date() } as PgUpdateSetSource<T>);
}
