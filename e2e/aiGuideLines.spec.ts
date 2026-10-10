import { expect, test } from '@playwright/test';

test('debug guide lines can be toggled during an AI race', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => window.__game.startEnduranceRace(1, false))).toBe(true);

  const toggle = page.locator('.lil-gui .controller.boolean').filter({ hasText: 'Show guide lines' }).locator('input');
  await expect(toggle).toBeVisible();
  expect(await page.evaluate(() => window.__game.getState().aiGuideSegments)).toBe(0);

  await toggle.check();
  await expect.poll(() => page.evaluate(() => window.__game.getState().aiGuideSegments)).toBeGreaterThan(0);

  await toggle.uncheck();
  await expect.poll(() => page.evaluate(() => window.__game.getState().aiGuideSegments)).toBe(0);
});
