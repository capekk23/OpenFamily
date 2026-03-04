import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests require DB + Redis — run sequentially to avoid conflicts
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
