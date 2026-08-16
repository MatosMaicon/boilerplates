import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/common/database/database.module';
import { ItemService } from '../item.service';
import type { ItemListQuery } from '../queries/item.query';
import type { Item } from '../item.schema';

const fakeItem: Item = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'meu-primeiro-item',
  status: 'published',
  category: 'article',
  title: 'Meu primeiro item',
  description: null,
  authorId: null,
  authorName: 'Ana Ribeiro',
  tags: ['exemplo', 'boilerplate'],
  viewCount: 0,
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};

// Query de domínio plana (o service depende de ItemListQuery, não do DTO).
function buildQuery(partial: Partial<ItemListQuery> = {}): ItemListQuery {
  return { page: 1, pageSize: 24, skip: 0, take: 24, ...partial };
}

/**
 * Fake do cliente Drizzle: qualquer método do query builder é encadeável e o
 * resultado é resolvido no `await`. `select()` sem projeção devolve as linhas;
 * `select({ value: count() })` devolve o agregado de contagem.
 *
 * Isto é um *fake*, não um mock de asserção: o teste verifica o resultado do
 * service, não quais métodos do Drizzle ele chamou. Acoplar o teste à forma da
 * query engessaria qualquer refatoração — quem cobre o SQL de verdade é o
 * teste de integração (`*.int-spec.ts`, Postgres real).
 */
function makeDb(rows: Item[], total = rows.length): Database {
  const thenable = (result: unknown): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'then'
            ? (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled)
            : () => thenable(result),
      },
    );

  return {
    select: (projection?: unknown) => thenable(projection ? [{ value: total }] : rows),
  } as unknown as Database;
}

describe('ItemService', () => {
  let service: ItemService;

  beforeEach(() => {
    service = new ItemService(makeDb([fakeItem]));
  });

  it('list() retorna wrapper paginado com a entidade crua (mapeamento fica no controller)', async () => {
    const result = await service.list(buildQuery());

    expect(result).toEqual({ items: [expect.any(Object)], page: 1, pageSize: 24, total: 1 });
    expect(result.items[0].slug).toBe('meu-primeiro-item');
    // O service devolve a entidade de domínio, com as colunas internas intactas —
    // é o DTO no boundary (controller) que decide o que expor.
    expect(result.items[0]).toHaveProperty('deletedAt', null);
    expect(result.items[0]).toHaveProperty('authorId', null);
  });

  it('list() sem resultados retorna wrapper vazio com total 0', async () => {
    service = new ItemService(makeDb([], 0));

    const result = await service.list(buildQuery({ category: 'tutorial' }));

    expect(result).toEqual({ items: [], page: 1, pageSize: 24, total: 0 });
  });

  it('findOne() lança 404 quando não encontra', async () => {
    service = new ItemService(makeDb([]));
    await expect(service.findOne('inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne() retorna a entidade crua quando encontra (por id ou slug)', async () => {
    const byId = await service.findOne(fakeItem.id);
    expect(byId.slug).toBe('meu-primeiro-item');
    expect(byId).toHaveProperty('deletedAt', null);

    const bySlug = await service.findOne('meu-primeiro-item');
    expect(bySlug.id).toBe(fakeItem.id);
  });
});
