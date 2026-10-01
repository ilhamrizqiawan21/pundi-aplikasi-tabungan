import { defineConfig } from '@playwright/test';

// Uji alur berjalan pada aplikasi Electron hasil `npm run build` (lihat `npm run test:e2e`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
});
