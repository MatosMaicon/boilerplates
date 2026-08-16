import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';

/** Env mínimo válido: banco + segredo do Better Auth (ambos obrigatórios). */
const minimalEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/boilerplate',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aceita env mínimo e aplica defaults', () => {
    const env = validateEnv({ ...minimalEnv });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:3000');
    expect(env.WEB_ORIGIN).toBe('http://localhost:3001');
  });

  it('coage PORT de string para número', () => {
    const env = validateEnv({ ...minimalEnv, PORT: '4000' });
    expect(env.PORT).toBe(4000);
  });

  it('derruba o boot (fail-fast) sem DATABASE_URL', () => {
    expect(() => validateEnv({ BETTER_AUTH_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
  });

  it('derruba o boot (fail-fast) sem BETTER_AUTH_SECRET', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgres://user:pass@localhost:5432/boilerplate' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejeita BETTER_AUTH_SECRET curto demais', () => {
    expect(() => validateEnv({ ...minimalEnv, BETTER_AUTH_SECRET: 'curto' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('rejeita NODE_ENV fora do enum', () => {
    expect(() => validateEnv({ ...minimalEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
