import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./web/tests/setup-vitest.js'],
    include: ['web/**/*.test.{js,jsx}'],
    globals: true,
    css: true,
  },
})
