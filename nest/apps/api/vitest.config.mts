import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Config em .mts (ESM) porque vite-tsconfig-paths/unplugin-swc são ESM-only e o
// projeto é CommonJS (NestJS). Unit tests apenas — integração em .integration.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.int-spec.ts'],
  },
  plugins: [
    tsconfigPaths(),
    // swc mantém o emitDecoratorMetadata (DI do Nest) funcionando sob o Vitest.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
