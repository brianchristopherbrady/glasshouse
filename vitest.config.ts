import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/server/**/*.test.ts',
      'apps/web/**/*.test.ts',
      'examples/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Integration suites spawn `prisma db push` and boot Fastify per file;
    // cold starts (fresh CI runners, first run after install) need headroom.
    testTimeout: 20_000,
    hookTimeout: 90_000,
  },
});
