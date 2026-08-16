import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Config do drizzle-kit (migrations, push, studio). Ver apps/api/CLAUDE.md.
 *
 * `import 'dotenv/config'` carrega o .env para os comandos de CLI (o drizzle-kit
 * não lê .env sozinho). Migrations usam a DIRECT_URL (Neon direto, sem o pooler)
 * quando presente — o runtime da API usa a DATABASE_URL (pooled).
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
