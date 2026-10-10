import { devices, expect, test } from '@playwright/test';
import { joinWithGamepad, openGame } from './support/gamepad';

test('only the frame rate is always on screen, in the lobby and in a race', async ({ page }) => {
  await openGame(page);
  const readout = page.locator('c-perf-readout');
  await expect(readout).toBeVisible();
  await expect(readout).toContainText(/^\s*(\d+ FPS|FPS …)\s*$/);

  await joinWithGamepad(page);
  await expect(readout).toBeVisible();

  const box = await readout.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
});

test.describe('on a phone', () => {
  const { defaultBrowserType: _ignored, ...IPHONE } = devices['iPhone 13'];
  test.use({ ...IPHONE });

  test('the frame rate never lies on the touch stick in a race', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.waitForFunction(() => window.__game.getState().playerCount === 1);
    await page.evaluate(() => window.__game.startGameForTest('race', false));
    const stick = (await page.locator('#stick-base').boundingBox())!;
    const readout = (await page.locator('c-perf-readout').boundingBox())!;
    const overlapsSideways = readout.x < stick.x + stick.width && stick.x < readout.x + readout.width;
    const overlapsUpright = readout.y < stick.y + stick.height && stick.y < readout.y + readout.height;
    expect(overlapsSideways && overlapsUpright).toBe(false);
  });
});
