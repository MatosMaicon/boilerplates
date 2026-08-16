import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../identity/user.schema';

/**
 * "Entity" do bounded context `example` — a tabela `items` e seus enums.
 *
 * ⚠️ ESTE MÓDULO É EXEMPLO. Ele existe para que os padrões descritos no
 * `apps/api/CLAUDE.md` tenham uma implementação viva (e testada) em vez de só
 * prosa. Ao começar um projeto de verdade, renomeie-o para o seu primeiro
 * bounded context ou apague-o — mas leia antes o que ele demonstra:
 *
 *   - schema co-localizado no módulo, reexportado pelo barrel `src/db/schema.ts`
 *   - tipos INFERIDOS (`$inferSelect`/`$inferInsert`), sem codegen
 *   - enum nativo do Postgres e `TEXT[]` (coisas que um mock não pega — daí o
 *     teste de integração com Testcontainers)
 *   - FK que não cascateia + coluna interna que NÃO aparece no DTO
 *   - as três colunas de convenção: created_at / updated_at / deleted_at
 *
 * Soft delete NÃO é automático no Drizzle — use `notDeleted()` nas leituras e
 * `softDelete()` nas exclusões (`common/database/soft-delete.ts`).
 */

export const itemStatus = pgEnum('item_status', ['draft', 'published', 'archived']);
export const itemCategory = pgEnum('item_category', ['article', 'tutorial', 'note']);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    status: itemStatus('status').notNull().default('draft'),
    category: itemCategory('category').notNull(),

    title: text('title').notNull(),
    description: text('description'),

    // `authorName` é denormalizado para exibir sem join. A FK é nullable e usa
    // `set null`: remover o autor não pode derrubar o item.
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),

    // TEXT[] nativo do Postgres.
    tags: text('tags').array().notNull().default([]),

    viewCount: integer('view_count').notNull().default(0),
    publishedAt: timestamp('published_at', { precision: 3 }),

    // Convenções globais.
    createdAt: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { precision: 3 }),
  },
  (t) => [
    index('items_status_published_at_idx').on(t.status, t.publishedAt),
    index('items_category_status_idx').on(t.category, t.status),
  ],
);

/** Linha lida da tabela. */
export type Item = typeof items.$inferSelect;
/** Payload de insert (colunas com default/geradas são opcionais). */
export type NewItem = typeof items.$inferInsert;

export type ItemStatusValue = (typeof itemStatus.enumValues)[number];
export type ItemCategoryValue = (typeof itemCategory.enumValues)[number];
