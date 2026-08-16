import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * "Entities" do bounded context `identity` — identidade E domínio na MESMA
 * tabela `users` (ver ADR 0006).
 *
 * Com o Better Auth rodando dentro da própria API, não existe IdP externo para
 * espelhar: `email`, `emailVerified` e `role` são canônicos aqui. Não há
 * sincronização nem claim a reconciliar.
 *
 * As quatro tabelas do núcleo do Better Auth (`users`, `sessions`, `accounts`,
 * `verifications`) são declaradas em Drizzle puro; o adapter recebe este schema
 * com `usePlural: true`. **Os nomes das propriedades TS batem exatamente com os
 * nomes de campo do Better Auth** (`emailVerified`, `userId`, …) — só as
 * colunas SQL são snake_case. Isso é deliberado: mapear via `fieldName` tem bug
 * conhecido no adapter Drizzle.
 *
 * Para adicionar um campo de domínio ao usuário: declare a coluna aqui E o
 * `additionalFields` correspondente em `common/auth/auth.provider.ts`. Os dois
 * lados precisam concordar.
 */

/**
 * Papéis. Um usuário tem UM papel, não uma lista — o enum é único de propósito.
 * `user` e `admin` são o mínimo genérico; troque pelos papéis do seu domínio.
 */
export const userRole = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable(
  'users',
  {
    // UUID em vez do id string default do Better Auth: FKs de domínio ficam
    // uuid. O `generateId` da config emite randomUUID().
    id: uuid('id').primaryKey().defaultRandom(),

    // Núcleo do Better Auth.
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),

    // Domínio — canônico aqui, sem espelho em lugar nenhum.
    role: userRole('role').notNull().default('user'),

    // Aceite dos Termos (LGPD) — timestamp + versão aceita.
    termsAcceptedAt: timestamp('terms_accepted_at', { precision: 3 }),
    termsVersion: text('terms_version'),

    createdAt: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { precision: 3 }),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email), index('users_role_idx').on(t.role)],
);

/**
 * Sessões ativas. O cookie do Better Auth carrega o `token` daqui — o guard
 * resolve a sessão contra esta tabela a cada request (ver `common/auth`).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { precision: 3 }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('sessions_token_idx').on(t.token),
    index('sessions_user_id_idx').on(t.userId),
  ],
);

/**
 * Credenciais e identidades federadas. Para e-mail/senha o `providerId` é
 * `credential` e o hash da senha fica em `password` (hashing é do Better Auth —
 * nunca gravamos senha em texto). Para social login guarda os tokens do provedor.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { precision: 3 }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { precision: 3 }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('accounts_user_id_idx').on(t.userId),
    index('accounts_provider_idx').on(t.providerId, t.accountId),
  ],
);

/** Tokens de uso único (verificação de e-mail, reset de senha). */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { precision: 3 }).notNull(),
    createdAt: timestamp('created_at', { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/**
 * Estado do rate limit do Better Auth — a proteção contra força bruta das
 * rotas `/auth/*`.
 *
 * Usamos `storage: 'database'` em vez do default `'memory'` porque a API pode
 * escalar horizontal: com memória cada réplica conta o seu próprio balde, então
 * o limite efetivo vira N× o configurado, e todo restart zera os contadores.
 *
 * ⚠️ Formato ditado pelo Better Auth (`rateLimitSchema`): `key`, `count`,
 * `lastRequest`. Não invente colunas nem renomeie — o adapter lê por esses
 * nomes. `lastRequest` é epoch em **milissegundos**, que não cabe em `integer`
 * (estoura 2^31 desde 1970+24 dias), por isso `bigint` com `mode: 'number'`.
 *
 * Exceção consciente à convenção de `created_at`/`updated_at`/`deleted_at`: é
 * estado efêmero de infraestrutura, não entidade de negócio — soft delete aqui
 * não significaria nada.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    count: integer('count').notNull(),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('rate_limits_key_idx').on(t.key)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

/** Linha lida da tabela. */
export type User = typeof users.$inferSelect;
/** Payload de insert (colunas com default/geradas são opcionais). */
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;

export type UserRoleValue = (typeof userRole.enumValues)[number];
