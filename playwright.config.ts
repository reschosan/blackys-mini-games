import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testIgnore: ['previewMode.spec.ts', 'layoutAudit.spec.ts', 'layoutAuditGuest.spec.ts'],
  // The tests check the German texts; English is tested on its own (locale en-US).
  use: { locale: 'de-DE', baseURL: 'http://localhost:5180', launchOptions: { args: ['--use-gl=angle', '--use-angle=metal'] } },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
  },
});
