import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { LoggingModule } from './platform/logging/logging.module';
import { AuthGuard } from './common/auth/auth.guard';
import { AuthProviderModule } from './common/auth/auth.provider';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ExampleModule } from './modules/example/example.module';

@Module({
  imports: [
    // Transversais
    AppConfigModule,
    LoggingModule,
    // Rate limit das rotas do Nest. NÃO cobre `/auth/*` — essas ficam fora do
    // router do Nest e são limitadas pelo próprio Better Auth (ver
    // common/auth/auth.provider.ts).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthProviderModule,
    HealthModule,
    // Bounded contexts — um módulo por contexto, não por tela.
    IdentityModule,
    ExampleModule,
  ],
  providers: [
    // ORDEM IMPORTA: o throttler roda ANTES do guard de sessão, para que uma
    // enxurrada anônima seja barrada sem custar uma consulta de sessão ao
    // Postgres por request.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guard global de sessão — @Public() libera rotas, @Roles() restringe.
    { provide: APP_GUARD, useClass: AuthGuard },
    // Normaliza toda exceção em application/problem+json (RFC 9457).
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
