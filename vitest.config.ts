import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['functions/**/*.workers.test.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/engine/puzzleWorker.ts'],
      thresholds: {
        statements: 30,
        branches: 20,
        functions: 20,
        lines: 30,
      },
    },
  },
});
