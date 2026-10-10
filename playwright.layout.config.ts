import { defineConfig } from '@playwright/test';

/** Layout audit over every screen size: `npm run test:e2e:layout`. Slow on purpose; run it after every change to the interface. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['layoutAudit.spec.ts', 'layoutAuditGuest.spec.ts'],
  workers: 1,
  use: {
    baseURL: 'http://localhost:5184',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=metal', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  // Every language once: the texts differ in length, so each must fit on every screen.
  projects: [
    { name: 'German', use: { locale: 'de-DE' } },
    { name: 'English', use: { locale: 'en-US' } },
  ],
  webServer: {
    command: 'npm run dev -- --host --port 5184 --strictPort',
    url: 'http://localhost:5184',
    reuseExistingServer: false,
  },
});
