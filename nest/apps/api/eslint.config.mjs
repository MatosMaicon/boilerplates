// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 (flat config) com typescript-eslint `recommendedTypeChecked`.
 *
 * O nível type-checked é intencional: as regras que dependem do type-checker
 * (`no-floating-promises`, `no-misused-promises`) são as que pegam a classe de
 * bug mais comum num codebase Nest/BullMQ — promise não-aguardada em service,
 * handler async passado onde se espera callback síncrono.
 *
 * `eslint-config-prettier` entra POR ÚLTIMO e desliga toda regra de formatação:
 * layout é responsabilidade do Prettier, o ESLint só cuida de correção.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // SQL + snapshots gerados pelo drizzle-kit — nunca editados à mão.
      'drizzle/**',
      'coverage/**',
      // Configs ESM fora do tsconfig; sem type info não dá para lintar com
      // as regras type-checked.
      '*.config.mts',
      'eslint.config.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefixo `_` marca parâmetro deliberadamente não usado — o padrão nos
      // stubs (ex.: StorageService.getPresignedDownloadUrl).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Import de tipo explícito (`import type`) evita que o decorator metadata
      // do Nest arraste o módulo para o bundle em runtime.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  {
    // Testes: `expect(mock.method)` dispara unbound-method sem que haja bug, e
    // mocks são `any` por natureza. Relaxa só onde o ruído é estrutural.
    files: ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // Mock async que não aguarda nada é a forma normal de dublê, não um bug.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
