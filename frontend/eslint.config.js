import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Idiomatic data-loading effects set state synchronously (e.g. setLoading(true)
      // before a fetch, clearing a counter on open). This recent heuristic rule flags
      // those as "errors" though they're correct; keep it visible as a warning rather
      // than failing lint or forcing risky refactors of working effects.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
