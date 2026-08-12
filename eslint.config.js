import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'reference', 'design_handoff_slate_whiteboard'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The port keeps the prototype's `any`-shaped boundaries (Excalidraw JSON,
      // the GIS global) where narrowing would change runtime behaviour.
      '@typescript-eslint/no-explicit-any': 'off',
      // Empty catch bodies are load-bearing here: the prototype swallows storage
      // and decode failures deliberately, and each one carries a comment saying so.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
