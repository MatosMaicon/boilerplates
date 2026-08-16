import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PageParams } from './page-params';

/**
 * Paginação por offset/página (ADR 0003). Reutilizada por todas as listas.
 * Implementa `PageParams` — o contrato plano que os services consomem, para o
 * service não depender deste DTO de apresentação.
 */
export class PaginationQueryDto implements PageParams {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (1-based).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 24, description: 'Itens por página.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 24;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}
