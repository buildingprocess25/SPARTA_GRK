import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const eslintConfig = [
  {
    ignores: [
      'src/generated/**',
      '.next/**',
      'node_modules/**',
      'dist/**',
      'test-fixtures/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,mjs}', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      ...reactHooks.configs.recommended.rules,
    },
  },
];

export default eslintConfig;

