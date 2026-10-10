import { defineConfig } from '@playwright/test';

/** The production build as `vite preview` serves it: it must look like the real game (no tuning panel). */
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['previewMode.spec.ts'],
  workers: 1,
  use: { locale: 'de-DE', baseURL: 'http://localhost:5183' },
  webServer: {
    command: 'npm run build && npx vite preview --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
