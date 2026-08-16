import 'dotenv/config';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { items, type NewItem } from '../modules/example/item.schema';

/**
 * Seed idempotente (upsert por slug) do módulo de exemplo.
 * `import 'dotenv/config'` carrega o .env — rode com `npm run db:seed`.
 */
const rows: NewItem[] = [
  {
    slug: 'como-usar-este-boilerplate',
    status: 'published',
    category: 'tutorial',
    title: 'Como usar este boilerplate',
    description: 'Um item publicado — aparece na listagem pública.',
    authorName: 'Ana Ribeiro',
    tags: ['boilerplate', 'tutorial'],
    publishedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    slug: 'notas-de-arquitetura',
    status: 'published',
    category: 'note',
    title: 'Notas de arquitetura',
    description: 'Outro item publicado, de outra categoria.',
    authorName: 'Bruno Lima',
    tags: ['arquitetura'],
    publishedAt: new Date('2026-01-02T00:00:00Z'),
  },
  {
    // Rascunho: existe no banco mas NÃO deve aparecer em GET /items.
    slug: 'rascunho-nao-publicado',
    status: 'draft',
    category: 'article',
    title: 'Rascunho não publicado',
    authorName: 'Ana Ribeiro',
    tags: [],
  },
];

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    for (const row of rows) {
      await db.insert(items).values(row).onConflictDoUpdate({ target: items.slug, set: row });
    }

    const [{ value: total }] = await db.select({ value: count() }).from(items);
    console.log(`Seed concluído — ${String(total)} itens na tabela.`);
  } finally {
    await pool.end();
  }
}

void seed();
