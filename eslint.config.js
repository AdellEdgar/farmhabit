import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/target/**', '**/src-tauri/gen/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // El núcleo no puede depender de la UI ni de la plataforma.
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', '@tauri-apps/*', '@farmhabit/app'] },
      ],
      'no-console': 'error',
    },
  },
  {
    files: ['apps/app/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
