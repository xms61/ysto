import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The layer rules from ARCHITECTURE.md: which folder may import which.
function restrictImports({ patterns = [], paths = [] }) {
  return { 'no-restricted-imports': ['error', { patterns, paths }] };
}
const NO_NODE_BUILTINS = {
  regex: '^node:',
  message: 'This code also runs in the browser; Node built-ins are not available.',
};
const SRC_NOT_SERVER = { regex: '(^|/)server/', message: 'src/ never imports server/; share code through shared/.' };
const SHARED_ALONE = { regex: '(^|/)(server|src)/', message: 'shared/ imports neither server/ nor src/.' };
const SERVER_NOT_SRC = { regex: '(^|/)src/', message: 'server/ never imports src/; share code through shared/.' };
const NO_SQLITE = { name: 'node:sqlite', message: 'Only server/catalog/ and scripts/catalog/ open SQLite.' };

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'data/', 'test-results/', 'playwright-report/', 'blob-report/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: restrictImports({ patterns: [SRC_NOT_SERVER, NO_NODE_BUILTINS] }),
  },
  {
    files: ['shared/**/*.ts'],
    rules: restrictImports({ patterns: [SHARED_ALONE, NO_NODE_BUILTINS] }),
  },
  {
    files: ['server/**/*.ts'],
    ignores: ['server/catalog/**'],
    rules: restrictImports({ patterns: [SERVER_NOT_SRC], paths: [NO_SQLITE] }),
  },
  {
    files: ['server/catalog/**/*.ts'],
    rules: restrictImports({ patterns: [SERVER_NOT_SRC] }),
  },
  {
    files: ['scripts/**/*.ts'],
    ignores: ['scripts/catalog/**'],
    rules: restrictImports({ paths: [NO_SQLITE] }),
  },
  // One place reads env vars, so every variable is validated once and listed in .env.example.
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', 'src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    ignores: ['server/config.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read environment variables in server/config.ts only.' },
      ],
    },
  },
]);
