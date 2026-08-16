import type { PageParams } from '@/common/pagination/page-params';
import type { ItemCategoryValue } from '../item.schema';

/**
 * Contrato de entrada (domínio) da listagem pública. Plano e sem decorators —
 * o `ItemService` depende só disto, nunca do `ItemQueryDto`.
 *
 * O `ItemQueryDto` (apresentação) **implementa** esta interface, então o
 * controller passa o DTO como-está, sem mapeamento, enquanto a query HTTP for
 * 1:1 com a de domínio. Se um dia divergirem (normalização, campos renomeados,
 * filtros derivados), troca-se por mapeamento explícito no boundary.
 */
export interface ItemListQuery extends PageParams {
  /** Filtra por categoria; ausente = todas. */
  category?: ItemCategoryValue;
}
