import { inject } from 'vitest';

/**
 * setupFile de integração: roda em cada worker ANTES de qualquer spec (e, portanto,
 * antes do `import AppModule` avaliar `ConfigModule.forRoot`/validateEnv). Publica a
 * connection string do Postgres efêmero (Testcontainers, via globalSetup → provide)
 * no process.env para o boot do Nest e o cliente Drizzle a encontrarem.
 */
const url = inject('databaseUrl');
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

/**
 * ⚠️ Todo env OBRIGATÓRIO do `env.schema.ts` precisa ser injetado aqui.
 *
 * O `validateEnv` roda no import do AppModule e derruba a suíte inteira se
 * faltar alguma variável. Depender do `.env` da máquina faria o teste passar
 * para quem já configurou o projeto e falhar num clone limpo — o pior tipo de
 * teste. Ao tornar uma variável obrigatória no schema, acrescente um valor de
 * teste aqui.
 */
process.env.BETTER_AUTH_SECRET ??= 'test-secret-'.padEnd(32, 'x');
process.env.NODE_ENV = 'test';
