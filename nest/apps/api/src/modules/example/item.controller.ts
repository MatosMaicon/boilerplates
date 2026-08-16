import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/auth/public.decorator';
import { ApiPaginatedResponse, mapPaginated, type Paginated } from '@/common/pagination/paginated';
import { ItemService } from './item.service';
import { ItemDto } from './dto/item.dto';
import { ItemQueryDto } from './dto/item-query.dto';

/**
 * Controller de exemplo. Note o que ele NÃO faz: nenhuma regra de negócio.
 * Só roteia, valida a entrada (via DTO + ValidationPipe global) e projeta a
 * saída no boundary — `fromEntity` para recurso único, `mapPaginated` para lista.
 */
@ApiTags('example')
@Controller('items')
export class ItemController {
  constructor(private readonly items: ItemService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista os itens publicados (paginado).' })
  @ApiPaginatedResponse(ItemDto)
  async list(@Query() query: ItemQueryDto): Promise<Paginated<ItemDto>> {
    const page = await this.items.list(query);
    return mapPaginated(page, ItemDto.fromEntity);
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: 'Detalhe público de um item por id (uuid) ou slug.' })
  @ApiParam({ name: 'idOrSlug', description: 'UUID ou slug do item.' })
  @ApiOkResponse({ type: ItemDto })
  async findOne(@Param('idOrSlug') idOrSlug: string): Promise<ItemDto> {
    return ItemDto.fromEntity(await this.items.findOne(idOrSlug));
  }
}
