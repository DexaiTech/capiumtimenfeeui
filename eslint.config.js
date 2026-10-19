import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Import boundaries (README, "Project structure"):
 * app → pages and features → components and services → hooks, utils, types, constants.
 * Enforced with the built-in no-restricted-imports rule, per folder.
 */
const boundary = (files, patterns) => ({
  files,
  ignores: ['**/*.test.{ts,tsx}', 'src/test/**'],
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

const featureInternals = {
  // The router loads each feature page file on its own (one chunk per page).
  group: ['@/features/*/*', '!@/features/*/pages', '!@/features/*/pages/*'],
  message: 'Import a feature through its index.ts, not from its internals.',
};
/** Inside the features themselves a page file is internal too: only the router loads it. */
const featureInternalsStrict = {
  group: ['@/features/*/*'],
  message: 'Import a feature through its index.ts, not from its internals.',
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'playwright-report',
      'test-results',
      'public/mockServiceWorker.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is never used; render through React elements.',
        },
        {
          selector: 'MemberExpression[object.name=/^(localStorage|sessionStorage)$/]',
          message:
            'Web storage holds preferences only, through the persisted Zustand stores. Never tokens.',
        },
      ],
    },
  },
  boundary(
    ['src/components/ui/**'],
    [
      {
        group: ['@/features/**', '@/pages/**', '@/services/**', '@/app/**'],
        message: 'Primitives know nothing about the product.',
      },
      {
        group: ['@/components/layout/**', '@/components/forms/**'],
        message: 'Primitives do not depend on higher-level components.',
      },
    ],
  ),
  boundary(
    ['src/components/**'],
    [
      {
        group: ['@/features/**', '@/pages/**'],
        message: 'Components do not import features or pages.',
      },
    ],
  ),
  boundary(
    ['src/features/**'],
    [
      {
        group: ['@/pages/**', '@/app/router/**', '@/app/providers/**'],
        message: 'Features do not import pages or app wiring.',
      },
      featureInternalsStrict,
    ],
  ),
  boundary(['src/pages/**', 'src/app/**'], [featureInternals]),
  boundary(
    ['src/services/**', 'src/utils/**', 'src/constants/**', 'src/types/**', 'src/hooks/**'],
    [
      {
        group: ['@/components/**', '@/features/**', '@/pages/**', '@/app/**'],
        message: 'Lower layers do not import UI or features.',
      },
    ],
  ),
  {
    files: ['*.config.{js,ts}', 'tests/e2e/**', 'public/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-restricted-syntax': 'off', 'no-var': 'off' },
  },
  prettier,
);
