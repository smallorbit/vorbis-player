import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import propsExplicitUndefined from './eslint-rules/props-explicit-undefined.js'

export default tseslint.config(
  { ignores: ['dist', 'eslint-rules/__tests__/**'] },
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
      vorbis: { rules: { 'props-explicit-undefined': propsExplicitUndefined } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'vorbis/props-explicit-undefined': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/__tests__/**',
      'src/test/**',
      // The helper is the only production module allowed to touch localStorage.
      'src/utils/persistedStorage.ts',
      // Remaining raw writers are not useLocalStorage-backed (auth/session/
      // debug/migration). Fold them in as later WS3 issues close those seams.
      'src/services/spotify/auth.ts',
      'src/providers/dropbox/dropboxAuthAdapter.ts',
      'src/services/sessionPersistence.ts',
      'src/services/settings/pinnedItemsStorage.ts',
      'src/services/cache/likedCountSnapshot.ts',
      'src/contexts/ProfilingContext.tsx',
      'src/contexts/VisualizerDebugContext.tsx',
      'src/components/DebugOverlay.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="localStorage"]',
          message:
            'Use persistedStorage helpers (readLocalStorageRaw / writeLocalStorageJson / removeLocalStorageKey) so same-tab listeners stay in sync.',
        },
        {
          selector: 'MemberExpression[object.object.name="window"][object.property.name="localStorage"]',
          message:
            'Use persistedStorage helpers (readLocalStorageRaw / writeLocalStorageJson / removeLocalStorageKey) so same-tab listeners stay in sync.',
        },
      ],
    },
  },
  {
    files: ['playwright/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-empty-pattern': 'off',
    },
  },
)
