import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores, defineConfig } from 'eslint/config';
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';
import love from 'eslint-config-love';

export default defineConfig([
  globalIgnores(['dist']),
  js.configs.recommended,
  tseslint.configs.eslintRecommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  tseslint.configs.strict,
  love,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  reactX.configs['recommended-typescript'],
  reactDom.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // We were violating these rules; turning them off so we can re-enable alongside fixes in a reasonable way
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-x/no-use-context': 'off',
      'react-x/no-context-provider': 'off',
      'react-x/no-unstable-context-value': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'no-console': 'off',
      'radix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      'arrow-body-style': 'off',
      'complexity': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/init-declarations': 'off',
      'max-lines': 'off',
      'no-negated-condition': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-misused-spread': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
]);
