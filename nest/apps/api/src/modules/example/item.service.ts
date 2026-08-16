import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '@/common/database/database.module';
import { notDeleted } from '@/common/database/soft-delete';
import { Paginated, paginate } from '@/common/pagination/paginated';
import { items, type Item } from './item.schema';
import type { ItemListQuery } from './queries/item.query';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Service de exemplo — a referência viva dos padrões do `apps/api/CLAUDE.md`:
 *
 *   - recebe o tipo de domínio plano (`ItemListQuery`), NUNCA o DTO
 *   - devolve a ENTIDADE (`Item`), nunca o DTO — a projeção é do controller
 *   - aplica `notDeleted()` em toda leitura (soft delete não é automático)
 *   - pagina com `paginate()` de `common/pagination`
 */
@Injectable()
export class ItemService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Listagem pública: só item publicado e vivo. */
  async list(query: ItemListQuery): Promise<Paginated<Item>> {
    const where = and(
      notDeleted(items.deletedAt),
      eq(items.status, 'published'),
      query.category ? eq(items.category, query.category) : undefined,
    );

    const [rows, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(items)
        .where(where)
        .orderBy(desc(items.publishedAt))
        .offset(query.skip)
        .limit(query.take),
      this.db.select({ value: count() }).from(items).where(where),
    ]);

    return paginate(rows, total, query);
  }

  /** Detalhe público por id (uuid) ou slug. 404 se não existir ou não estiver publicado. */
  async findOne(idOrSlug: string): Promise<Item> {
    const identifier = UUID_RE.test(idOrSlug) ? eq(items.id, idOrSlug) : eq(items.slug, idOrSlug);

    const [row] = await this.db
      .select()
      .from(items)
      .where(and(notDeleted(items.deletedAt), identifier, eq(items.status, 'published')))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Item "${idOrSlug}" não encontrado.`);
    }

    return row;
  }
}
