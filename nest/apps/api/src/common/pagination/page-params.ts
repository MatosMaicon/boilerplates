/**
 * Contrato plano de paginação por offset (ADR 0003) — sem decorators nem
 * dependência de framework. É o que os *services* consomem: o
 * `PaginationQueryDto` (camada de apresentação) **implementa** este tipo, então
 * o service depende só daqui e nunca do DTO. Todo filtro de domínio de listagem
 * estende `PageParams`.
 */
export interface PageParams {
  /** Página 1-based (para o envelope de resposta). */
  page: number;
  /** Itens por página (para o envelope de resposta). */
  pageSize: number;
  /** Deslocamento para o `.offset()` do Drizzle: `(page - 1) * pageSize`. */
  skip: number;
  /** Limite para o `.limit()` do Drizzle: `pageSize`. */
  take: number;
}
