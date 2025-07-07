import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';
import reactX from 'eslint-plugin-react-x';       // New
import reactDom from 'eslint-plugin-react-dom';   // New

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      
      // React-specific rules
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      
      // New React-X and React-DOM rules
      reactX.configs['recommended-typescript'],  // TypeScript-aware React rules
      reactDom.configs.recommended,             // React DOM specific rules
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'], // Adjust paths as needed
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Optional: Add custom rule overrides here
      '@typescript-eslint/no-explicit-any': 'warn', // Example custom rule
    },
  },
]);
