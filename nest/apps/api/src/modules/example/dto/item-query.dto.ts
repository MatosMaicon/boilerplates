import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import type { ItemListQuery } from '../queries/item.query';
import { itemCategory, type ItemCategoryValue } from '../item.schema';

/**
 * Filtros da listagem pública (`GET /items`). Implementa o contrato de domínio
 * `ItemListQuery`, então o controller passa este DTO direto ao service sem
 * mapeamento. Estende `PaginationQueryDto`, que já traz `page`/`pageSize` e
 * implementa `PageParams`.
 */
export class ItemQueryDto extends PaginationQueryDto implements ItemListQuery {
  @ApiPropertyOptional({ enum: itemCategory.enumValues, description: 'Filtra por categoria.' })
  @IsOptional()
  @IsEnum(itemCategory.enumValues)
  category?: ItemCategoryValue;
}
