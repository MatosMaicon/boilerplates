import { randomUUID } from 'node:crypto';
import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { DRIZZLE, type Database } from '@/common/database/database.module';
import type { Env } from '@/config/env.schema';
import {
  accounts,
  rateLimits,
  sessions,
  users,
  verifications,
} from '@/modules/identity/user.schema';

/**
 * Token de injeção da instância do Better Auth.
 *
 * O Better Auth roda DENTRO da API (não há IdP externo — ver ADR 0006): ele é o
 * auth server e grava direto no nosso Postgres, pelo mesmo `Pool` do
 * DatabaseModule. O `main.ts` monta o handler HTTP dele no Express e o
 * `AuthGuard` resolve a sessão por aqui.
 */
export const AUTH = Symbol('AUTH');

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(db: Database, config: ConfigService<Env, true>) {
  const baseURL = config.get('BETTER_AUTH_URL', { infer: true });
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });

  return betterAuth({
    baseURL,
    // `/auth` em vez do default `/api/auth` — a API não usa prefixo global.
    basePath: '/auth',
    secret: config.get('BETTER_AUTH_SECRET', { infer: true }),
    trustedOrigins: webOrigin ? [webOrigin] : [],

    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
      schema: { users, sessions, accounts, verifications, rateLimits },
    }),

    advanced: {
      // IDs em UUID para casar com as FKs de domínio. O default do Better Auth
      // seria uma string aleatória.
      database: { generateId: () => randomUUID() },
    },

    emailAndPassword: {
      enabled: true,
      // Ligue quando houver envio de e-mail configurado — sem provedor, isto
      // travaria todo cadastro novo.
      requireEmailVerification: false,
    },

    // ⚠️ Esta é a ÚNICA proteção das rotas `/auth/*`: o `@nestjs/throttler` é um
    // guard do Nest e o handler do Better Auth está montado direto no Express,
    // ANTES do router do Nest — guards não alcançam essas rotas. Justo as de
    // login e reset de senha. Não remova daqui achando que o throttler cobre.
    //
    // `storage: 'database'` (tabela `rate_limits`) em vez do default 'memory':
    // com 2+ réplicas, memória faz cada instância contar seu próprio balde — o
    // limite efetivo vira N× o configurado e restart zera tudo.
    rateLimit: { enabled: true, storage: 'database' },

    user: {
      additionalFields: {
        // `input: false` é a trava de segurança: impede que o payload público de
        // cadastro escolha o próprio papel. Nenhum caminho de cadastro pode
        // criar um `admin`. Todo campo privilegiado que você adicionar aqui
        // precisa de `input: false`.
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        deletedAt: { type: 'date', required: false, input: false },

        // Coletáveis no cadastro.
        termsAcceptedAt: { type: 'date', required: false, input: true },
        termsVersion: { type: 'string', required: false, input: true },
      },
    },
  });
}

/** Açúcar para injetar a instância do Better Auth num service/guard. */
export const InjectAuth = () => Inject(AUTH);

/**
 * Módulo global do auth server, no mesmo espírito do `DatabaseModule`: um único
 * `auth` compartilhado por toda a aplicação, construído sobre o `Pool` que já
 * existe (sem abrir uma segunda conexão).
 */
@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      useFactory: createAuth,
      inject: [DRIZZLE, ConfigService],
    },
  ],
  exports: [AUTH],
})
export class AuthProviderModule {}
