/**
 * Barrel do schema Drizzle — ponto único que o drizzle-kit (migrations) e o
 * cliente tipado (`drizzle(pool, { schema })`) consomem. As tabelas ficam
 * co-localizadas em cada bounded context (ver apps/api/CLAUDE.md); reexporte
 * cada uma aqui conforme as fatias entram.
 *
 * ⚠️ Esquecer de reexportar aqui é o erro silencioso mais comum: o código
 * compila, os testes de unidade passam, e o `db:generate` simplesmente não
 * enxerga a tabela nova — a migration sai vazia.
 */
export * from '../modules/identity/user.schema';
export * from '../modules/example/item.schema';
