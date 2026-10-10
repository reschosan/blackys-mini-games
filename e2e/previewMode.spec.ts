import { expect, test } from '@playwright/test';

test('the production build has no tuning panel, but the frame rate readout and the game', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.lil-gui')).toHaveCount(0);
  await expect(page.locator('c-perf-readout')).toBeVisible();
  await expect(page.locator('[data-testid=lobby]')).toBeVisible();
});
