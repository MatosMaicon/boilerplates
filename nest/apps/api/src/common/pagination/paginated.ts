import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';

/**
 * Wrapper de lista paginada (ADR 0003): `{ items, page, pageSize, total }`.
 * O único envelope da API — respostas de recurso único são cruas.
 */
export class Paginated<T> {
  @ApiProperty({ isArray: true })
  items!: T[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 24 })
  pageSize!: number;

  @ApiProperty({ example: 137, description: 'Total de itens (ignora a paginação).' })
  total!: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  query: { page: number; pageSize: number },
): Paginated<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Projeta os itens de uma página preservando os metadados. Usado no boundary
 * (controller) para mapear `Paginated<Entity>` do service → `Paginated<Dto>`
 * da resposta, sem o service precisar conhecer o DTO.
 */
export function mapPaginated<A, B>(page: Paginated<A>, fn: (item: A) => B): Paginated<B> {
  return { ...page, items: page.items.map(fn) };
}

/**
 * Decorator OpenAPI para respostas paginadas de um `model` concreto —
 * gera o schema de `Paginated<Model>` no Swagger.
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(Paginated, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(Paginated) },
          {
            properties: {
              items: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
}
