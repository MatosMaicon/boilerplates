import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { itemCategory, type Item, type ItemCategoryValue } from '../item.schema';

/**
 * Representação pública de um item — fonte do OpenAPI e, por ele, do cliente
 * tipado do `apps/web`. Só o que o público deslogado pode ver: sem `authorId`,
 * sem `status`, sem os timestamps de controle.
 */
export class ItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'meu-primeiro-item' })
  slug!: string;

  @ApiProperty({ enum: itemCategory.enumValues })
  category!: ItemCategoryValue;

  @ApiProperty({ example: 'Meu primeiro item' })
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ description: 'Nome do autor (denormalizado).' })
  authorName!: string;

  @ApiProperty({ isArray: true, type: String, example: ['exemplo', 'boilerplate'] })
  tags!: string[];

  @ApiProperty({ example: 0 })
  viewCount!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  publishedAt?: Date | null;

  /**
   * `this: void` declara que o método não usa `this` — é o que permite passá-lo
   * desacoplado (`mapPaginated(page, ItemDto.fromEntity)`, o padrão do boundary
   * descrito no CLAUDE.md) sem disparar `unbound-method`. Todo `fromEntity`
   * novo deve manter essa anotação.
   */
  static fromEntity(this: void, row: Item): ItemDto {
    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      title: row.title,
      description: row.description,
      authorName: row.authorName,
      tags: row.tags,
      viewCount: row.viewCount,
      publishedAt: row.publishedAt,
    };
  }
}
