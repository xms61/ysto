import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The layer rules from ARCHITECTURE.md: which folder may import which.
function restrictImports(...patterns) {
  return { 'no-restricted-imports': ['error', { patterns }] };
}
const NO_NODE_BUILTINS = {
  regex: '^node:',
  message: 'This code also runs in the browser; Node built-ins are not available.',
};

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
    rules: restrictImports(
      { regex: '(^|/)server/', message: 'src/ never imports server/; share code through shared/.' },
      NO_NODE_BUILTINS,
    ),
  },
  {
    files: ['shared/**/*.ts'],
    rules: restrictImports(
      { regex: '(^|/)(server|src)/', message: 'shared/ imports neither server/ nor src/.' },
      NO_NODE_BUILTINS,
    ),
  },
  {
    files: ['server/**/*.ts'],
    rules: restrictImports({ regex: '(^|/)src/', message: 'server/ never imports src/; share code through shared/.' }),
  },
  // One place reads env vars, so every variable is validated once and listed in .env.example.
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', 'src/**/*.{ts,tsx}'],
    ignores: ['server/config.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read environment variables in server/config.ts only.' },
      ],
    },
  },
]);
