import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite 8 transforms JSX with oxc (the React plugin handles the app). Vitest's
  // transform pipeline still reads this esbuild option, so only set it under test
  // — otherwise Vite warns that the esbuild option is ignored during dev/build.
  ...(process.env.VITEST ? { esbuild: { jsx: 'automatic' } } : {}),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
