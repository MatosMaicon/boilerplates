import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Integração: requer Docker (Testcontainers sobe um Postgres efêmero). O
// globalSetup materializa o schema e expõe DATABASE_URL via `provide`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.int-spec.ts', 'test/**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // Injeta DATABASE_URL no worker antes de qualquer spec importar o AppModule.
    setupFiles: ['./test/integration/setup-env.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
});
