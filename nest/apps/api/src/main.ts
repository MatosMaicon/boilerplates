import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AUTH, type Auth } from './common/auth/auth.provider';
import type { Env } from './config/env.schema';

/**
 * Entrypoint da API (HTTP + OpenAPI). SÓ enfileira jobs — o worker (worker.ts)
 * consome. Ver ADR 0004.
 */
async function bootstrap(): Promise<void> {
  // `bodyParser: false`: o handler do Better Auth precisa do corpo CRU e tem de
  // ser montado ANTES de qualquer parser (senão as requisições de auth penduram).
  // Registramos os parsers logo depois, para o resto da API.
  //
  // `bufferLogs: true`: segura os logs de boot até o pino assumir, senão as
  // primeiras linhas saem no formato do logger padrão do Nest.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(PinoLogger));
  const logger = app.get(PinoLogger);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  // `trust proxy` no Railway: sem isto o Express enxerga o IP do proxy da
  // plataforma em TODO request, e tanto o throttler quanto o rate limit do
  // Better Auth passam a contar o mundo inteiro num balde só — na prática,
  // proteção nenhuma. `1` = confia num único hop (o edge do Railway).
  // Fora de produção não há proxy, e confiar cegamente permitiria forjar
  // X-Forwarded-For para escapar do limite.
  app.set('trust proxy', isProduction ? 1 : false);

  // ⚠️ helmet ANTES do mount do Better Auth. O handler de auth é registrado
  // direto no Express e responde sem chamar `next()`, então qualquer
  // middleware registrado depois dele NÃO roda para `/auth/*` — justamente as
  // rotas de login e reset.
  //
  // A CSP padrão do helmet (`script-src 'self'`) bloqueia os scripts inline do
  // Swagger UI. Em vez de afrouxar a política da API inteira, relaxamos só em
  // `/docs`.
  const strictHelmet = helmet();
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/docs') ? docsHelmet(req, res, next) : strictHelmet(req, res, next),
  );

  // `credentials: true` é obrigatório: a sessão viaja em cookie httpOnly, e sem
  // isso o navegador não o envia.
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });

  // Auth server montado dentro da própria API (ADR 0006): `/auth/*splat` é
  // servido pelo Better Auth, fora do router do Nest — por isso não aparece no
  // OpenAPI.
  //
  // ⚠️ `*splat`, não `*`: o Nest 11 roda sobre Express 5 / path-to-regexp 8,
  // onde o coringa anônimo `*` deixou de ser path válido e o processo MORRE no
  // boot ("Missing parameter name"). O wildcard agora é obrigatoriamente
  // nomeado. `splat` é só o nome do parâmetro (convenção do Express 5) — o
  // valor casado vai parar em `req.params.splat`, que não usamos.
  //
  // `toNodeHandler` devolve uma Promise que o Express ignora: sem o `.catch`,
  // uma falha dentro do handler de auth vira unhandledRejection silenciosa e o
  // request pendura até o timeout. Encaminhar para o `next` entrega o erro ao
  // AllExceptionsFilter em vez de perdê-lo.
  const authHandler = toNodeHandler(app.get<Auth>(AUTH));
  app
    .getHttpAdapter()
    .getInstance()
    .all('/auth/*splat', (req: Request, res: Response, next: NextFunction) => {
      void authHandler(req, res).catch(next);
    });

  app.use(json());
  app.use(urlencoded({ extended: true }));

  // ValidationPipe global — descarta campos não declarados e coage tipos dos DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI — fonte da verdade dos tipos consumida pelo apps/web (ADR 0003).
  // As rotas `/auth/*` NÃO entram aqui (são servidas fora do router do Nest);
  // elas ficam documentadas à mão fora do OpenAPI.
  const openapi = new DocumentBuilder()
    .setTitle('API')
    .setDescription('Descreva sua API aqui.')
    .setVersion('0.1.0')
    .addCookieAuth('better-auth.session_token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openapi));

  // Encerramento gracioso: o Railway manda SIGTERM a cada deploy. Sem isto o
  // processo morre no meio das requisições em voo e o `onModuleDestroy` do
  // DatabaseModule nunca roda — conexões do pool ficam penduradas no Neon.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  logger.log(`API em http://localhost:${port} · OpenAPI em http://localhost:${port}/docs`);
}

void bootstrap();
