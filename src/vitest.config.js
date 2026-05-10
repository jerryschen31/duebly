import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['web/**/*.test.{js,jsx}'],
    setupFiles: ['./web/__tests__/setup.js'],
  },
})
