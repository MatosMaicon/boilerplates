import { z } from 'zod';

/**
 * Validação de ambiente com **fail-fast no boot**: falta uma variável
 * obrigatória, o processo não sobe. É deliberado — a alternativa (default
 * silencioso) troca um erro imediato e legível por um bug em produção horas
 * depois, quando algo tenta usar a config vazia.
 *
 * Ao adicionar uma integração (storage, pagamento, e-mail, busca…), declare a
 * variável aqui. Comece como `.optional()` enquanto a fatia não existe e
 * promova a obrigatória quando ela entrar — assim o boot passa a exigir
 * exatamente o que o código realmente usa.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Logging estruturado (pino). Em produção sai JSON de uma linha por request;
  // em dev, formatado por pino-pretty.
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Banco — obrigatório.
  DATABASE_URL: z.string().url(),
  // Conexão direta (sem pooler) usada pelas migrations. Alguns provedores
  // gerenciados exigem separar as duas; sem isso, o drizzle-kit usa a acima.
  DIRECT_URL: z.string().url().optional(),

  // Better Auth (ADR 0006) — o auth server roda dentro desta API.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'precisa de pelo menos 32 caracteres (openssl rand -base64 32)'),
  // URL pública da própria API — o Better Auth roda dentro dela (é o auth server).
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  // Origem do frontend, usada como trustedOrigin e no CORS com credenciais.
  WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Usado por `ConfigModule.forRoot({ validate })`. Lança com uma mensagem
 * legível listando cada variável inválida, derrubando o boot (fail-fast).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return parsed.data;
}
