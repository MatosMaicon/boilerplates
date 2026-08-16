import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from '@/common/auth/public.decorator';
import { DRIZZLE, type Database } from '@/common/database/database.module';

/**
 * Liveness e readiness são perguntas DIFERENTES e a plataforma reage a cada uma
 * de um jeito:
 *
 * - **liveness** (`/health`): "o processo está vivo?" Se falhar, o Railway
 *   REINICIA o contêiner. Não pode depender de serviço externo — banco fora do
 *   ar não é motivo para reiniciar a API em loop.
 * - **readiness** (`/health/ready`): "dá para me mandar tráfego?" Se falhar, a
 *   plataforma só para de rotear. Aqui sim o Postgres entra.
 *
 * Trocar os dois é o erro clássico: um healthcheck que pinga o banco e reinicia
 * o serviço transforma uma indisponibilidade do Neon em crash loop.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness — só afirma que o processo responde.' })
  check() {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness — verifica as dependências obrigatórias (Postgres).' })
  @ApiResponse({ status: 200, description: 'Pronta para receber tráfego.' })
  @ApiResponse({ status: 503, description: 'Alguma dependência obrigatória está fora.' })
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
    } catch (error) {
      // O detalhe fica no log; a resposta não descreve a topologia interna.
      this.logger.error('Readiness falhou: Postgres inacessível', error);
      throw new ServiceUnavailableException('Dependência indisponível: postgres');
    }

    return {
      status: 'ok',
      service: 'api',
      checks: { postgres: 'ok' },
      timestamp: new Date().toISOString(),
    };
  }
}
