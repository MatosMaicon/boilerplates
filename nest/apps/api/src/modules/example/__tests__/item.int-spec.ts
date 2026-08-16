import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { items } from '../item.schema';

/**
 * Prova a pilha ponta-a-ponta contra um Postgres REAL (Testcontainers):
 * HTTP → guard/@Public → ValidationPipe → ItemService → Drizzle → problem+json.
 * Requer Docker.
 *
 * Por que integração e não só unit: enum nativo, `TEXT[]`, unique e a interação
 * do soft delete com tudo isso são features do Postgres que um fake do query
 * builder nunca reproduz.
 *
 * ⚠️ Este teste NÃO passa pelo `main.ts` — `createTestingModule` monta o
 * AppModule direto. Nada aqui cobre helmet, o mount de `/auth/*splat` nem o
 * bootstrap. Depois de mexer no `main.ts`, suba a API de verdade.
 */
describe('Item — integração', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: NodePgDatabase;

  beforeAll(async () => {
    // DATABASE_URL já foi injetada pelo setupFile (test/integration/setup-env.ts).
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    // Seed com um cliente Drizzle cru (sem o helper) para poder escrever deletedAt.
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool);
    await db.delete(items);
    await db.insert(items).values([
      {
        slug: 'publicado',
        status: 'published',
        category: 'article',
        title: 'Publicado',
        authorName: 'Autora',
        tags: ['exemplo'],
        publishedAt: new Date(),
      },
      {
        slug: 'rascunho',
        status: 'draft',
        category: 'article',
        title: 'Rascunho',
        authorName: 'Autora',
      },
      {
        slug: 'publicado-mas-excluido',
        status: 'published',
        category: 'article',
        title: 'Excluído',
        authorName: 'Autora',
        publishedAt: new Date(),
        deletedAt: new Date(), // soft-deleted → não deve aparecer
      },
    ]);
  });

  afterAll(async () => {
    await pool?.end();
    await app?.close();
  });

  it('GET /items lista só publicado e vivo, no wrapper de paginação', async () => {
    const res = await request(app.getHttpServer()).get('/items').expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 24, total: 1 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe('publicado');
  });

  it('GET /items?category=tutorial respeita o filtro', async () => {
    const res = await request(app.getHttpServer()).get('/items?category=tutorial').expect(200);
    expect(res.body.total).toBe(0);
  });

  it('GET /items?category=invalida é rejeitado pelo ValidationPipe', async () => {
    await request(app.getHttpServer()).get('/items?category=invalida').expect(400);
  });

  it('GET /items/:slug retorna o recurso cru (sem colunas internas)', async () => {
    const res = await request(app.getHttpServer()).get('/items/publicado').expect(200);
    expect(res.body.slug).toBe('publicado');
    expect(res.body.tags).toEqual(['exemplo']);
    expect(res.body).not.toHaveProperty('deletedAt');
    expect(res.body).not.toHaveProperty('authorId');
  });

  it('GET /items/:slug de item soft-deleted responde 404', async () => {
    await request(app.getHttpServer()).get('/items/publicado-mas-excluido').expect(404);
  });

  it('GET /items/desconhecido responde 404 em application/problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/items/desconhecido').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      status: 404,
      title: expect.any(String),
      instance: expect.any(String),
    });
  });
});
