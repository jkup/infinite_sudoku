import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register': new URL('./src/test/pwaRegisterMock.ts', import.meta.url).pathname,
    },
  },
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
      // Set a few points under the measured level (63/60/67/66 on 2026-09-07) so
      // ordinary churn passes but a real regression fails CI. Raise them as
      // coverage grows; never lower them to make a change pass.
      thresholds: {
        statements: 60,
        branches: 56,
        functions: 64,
        lines: 63,
      },
    },
  },
});
