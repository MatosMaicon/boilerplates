import { describe, expect, it } from 'vitest';
import type { Item } from '../item.schema';
import { ItemDto } from '../dto/item.dto';

const entity: Item = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'meu-primeiro-item',
  status: 'published',
  category: 'article',
  title: 'Meu primeiro item',
  description: null,
  authorId: '22222222-2222-2222-2222-222222222222',
  authorName: 'Ana Ribeiro',
  tags: ['exemplo', 'boilerplate'],
  viewCount: 7,
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('ItemDto.fromEntity', () => {
  it('projeta os campos públicos da entidade', () => {
    const dto = ItemDto.fromEntity(entity);

    expect(dto.id).toBe(entity.id);
    expect(dto.slug).toBe('meu-primeiro-item');
    expect(dto.tags).toEqual(['exemplo', 'boilerplate']);
    expect(dto.publishedAt).toEqual(entity.publishedAt);
  });

  it('omite as colunas internas (authorId, status, timestamps de controle)', () => {
    const dto = ItemDto.fromEntity(entity);

    expect(dto).not.toHaveProperty('authorId');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
    expect(dto).not.toHaveProperty('deletedAt');
  });
});
