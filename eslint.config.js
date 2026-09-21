import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import propsExplicitUndefined from './eslint-rules/props-explicit-undefined.js'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'eslint-rules/__tests__/**'] },
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
    // F85: type-aware lint scoped to production src first (tests follow in a
    // later pass once the main surface is clean).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/test/**'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // #1700 raw-localStorage ban + #1706 prefix-literal ban. Combined in one
    // block so flat-config does not let a later no-restricted-syntax override
    // the earlier selectors.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/__tests__/**',
      'src/test/**',
      // The helper is the only production module allowed to touch localStorage.
      'src/utils/persistedStorage.ts',
      // Canonical home of every vorbis-player-* string literal.
      'src/constants/storage.ts',
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
        {
          selector: 'Literal[value=/^vorbis-player-/]',
          message:
            'Use STORAGE_KEYS from @/constants/storage instead of hardcoding vorbis-player- keys.',
        },
        {
          selector: 'TemplateLiteral[quasis.length=1][quasis.0.value.raw=/^vorbis-player-/]',
          message:
            'Use STORAGE_KEYS from @/constants/storage instead of hardcoding vorbis-player- keys.',
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
