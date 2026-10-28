import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'apps/renderer/src/engine/**/*.test.ts'],
    maxWorkers: 1,
    coverage: { reporter: ['text', 'json-summary'] },
  },
})
