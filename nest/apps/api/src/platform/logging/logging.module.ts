import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '@/config/env.schema';

/**
 * `pino-pretty` é devDependency: em produção o `npm ci --omit=dev` (ADR 0007)
 * não o instala. Resolver de forma condicional evita que um `NODE_ENV` mal
 * configurado no Railway derrube o boot por causa de um formatador de log.
 */
function prettyIsAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/** Rotas de infraestrutura: o Railway bate nelas o tempo todo, não viram log. */
const SILENT_PATHS = new Set(['/health', '/health/ready']);

/**
 * Logging estruturado (pino) para API e worker.
 *
 * O ganho central sobre o Logger padrão do Nest é o **correlation id por
 * request**: toda linha emitida durante um request carrega o mesmo `reqId`, e
 * ele volta no header `x-request-id` — dá para pegar o id de um erro relatado
 * pelo front e puxar exatamente aquele request no log do Railway.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),

            // Respeita o id que o proxy/front já tenha propagado; só gera um
            // quando não vem nenhum. Devolve sempre no header da resposta.
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const incoming = req.headers['x-request-id'];
              const id =
                typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },

            // ⚠️ Sem isto o cookie de sessão (e portanto o token) vai para o
            // log em texto claro a cada request autenticado.
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers.authorization',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },

            autoLogging: {
              ignore: (req: IncomingMessage) => SILENT_PATHS.has(req.url ?? ''),
            },

            // ⚠️ O pino-pretty roda num worker thread e pode NÃO dar flush nas
            // últimas linhas quando o processo encerra — em dev, os logs de
            // shutdown às vezes somem. Não é o hook falhando: rode com
            // NODE_ENV=production (sem transport) para vê-los.
            transport:
              !isProduction && prettyIsAvailable()
                ? {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'HH:MM:ss' },
                  }
                : undefined,
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
