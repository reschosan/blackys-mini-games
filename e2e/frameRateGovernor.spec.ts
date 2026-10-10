import { expect, test } from '@playwright/test';
import { openGame, startRaceWithGamepad } from './support/gamepad';

// A device that cannot keep up draws less: under 15 FPS "High" becomes "Low", and "Low" becomes bare bones.
// The slow device is a throttled processor.

test.setTimeout(150_000);

test('the host draws less when the race runs under 15 FPS: first "Niedrig", then bare bones, with a notice', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await page.waitForFunction(() => window.__game.getState().mapReady);
  const startQuality = await page.evaluate(() => window.__game.getState().graphicsQuality);
  const slowDown = await page.context().newCDPSession(page);
  await slowDown.send('Emulation.setCPUThrottlingRate', { rate: 70 });
  await expect.poll(() => page.evaluate(() => window.__game.getState().emergencyGraphics), { timeout: 100_000, intervals: [1000] }).toBe(true);
  expect(await page.evaluate(() => window.__game.getState().graphicsQuality)).toBe('low');
  await expect(page.locator('[data-testid=problems]')).toContainText('Hoppla');
  expect(startQuality === 'high' || startQuality === 'low').toBe(true);
});
