import { Module } from '@nestjs/common';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';

/**
 * Bounded context `example` — o módulo de referência do boilerplate.
 *
 * Renomeie-o para o seu primeiro contexto real (ou apague-o) ao iniciar o
 * projeto. Se apagar, lembre de remover também:
 *   - o import no `app.module.ts`
 *   - o reexport no barrel `src/db/schema.ts`
 *   - o seed em `src/db/seed.ts`
 *   - a migration da tabela `items` (ou gere uma nova que a derrube)
 */
@Module({
  controllers: [ItemController],
  providers: [ItemService],
  exports: [ItemService],
})
export class ExampleModule {}
