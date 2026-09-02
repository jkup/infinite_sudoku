import path from 'node:path';
import { buildPagesASSETSBinding, cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        compatibilityDate: '2024-01-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        serviceBindings: {
          ASSETS: await buildPagesASSETSBinding(path.resolve('public')),
        },
        bindings: {
          CLERK_SECRET: 'sk_test_not-a-real-secret',
          CLERK_PUBLIC: 'pk_test_not-a-real-key',
          TEST_MIGRATIONS: await readD1Migrations(path.resolve('db/migrations')),
        },
      },
    })),
  ],
  test: {
    include: ['functions/**/*.workers.test.ts'],
  },
});
