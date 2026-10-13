import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/** Twenty seeded all-AI races per map and difficulty: about two minutes, so `npm test` leaves them to `npm run test:ai`. */
const AI_RACE_SIMULATIONS = ['tests/ai/aiMapVerification.test.ts', 'tests/ai/aiLapTimes.test.ts'];

export default defineConfig({
  base: './',
  /** Host and guest must be the same build: the guest refuses a race of another one (maps, numbers and formats could differ). */
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [tailwindcss()],
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), join: resolve(import.meta.dirname, 'join.html') } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.AI_RACES ? [] : AI_RACE_SIMULATIONS,
    environment: 'node',
    /** The existing tests check the German texts; the English ones switch the language themselves. */
    setupFiles: ['tests/support/germanTexts.ts'],
  },
});
