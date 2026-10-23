import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
      {
        test: {
          name: 'perf',
          include: ['tests/perf/**/*.test.ts'],
          environment: 'node',
          testTimeout: 300000,
          hookTimeout: 300000,
        },
      },
    ],
  },
});
