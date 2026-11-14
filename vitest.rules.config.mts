import { defineConfig } from 'vitest/config';

// Security-rules tests. Run via `npm run test:rules`, which starts the Firestore + Storage
// emulators (project demo-mcl-portal) with `firebase emulators:exec`.
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.rules.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
