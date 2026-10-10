import { expect, test } from '@playwright/test';

/** Naturpfad is the map behind the lobby and already loaded when a race starts, so the loading screen is checked on the Mondbasis. */
const SPACE_MAP_INDEX = 2;
/** On a fast machine the models would be there before the loading screen can be seen, so they are held back. */
const MODEL_DELAY_MS = 1500;

test('the boot screen fades away once the game has loaded', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15000 });
});

test('a map with models shows the loading screen and holds the race start until its models are loaded', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/models/space-pack/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MODEL_DELAY_MS));
    await route.continue();
  });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate((index) => window.__game.startEnduranceRace(index, false), SPACE_MAP_INDEX)).toBe(true);

  await expect(page.locator('[data-testid=loading]')).toBeVisible();
  await expect(page.locator('[data-testid=loading]')).toContainText('Mondbasis');
  expect(await page.evaluate(() => window.__game.getState().mapReady)).toBe(false);
  expect(await page.evaluate(() => window.__game.getState().raceTimeSeconds)).toBe(0);

  await expect.poll(() => page.evaluate(() => window.__game.getState().mapReady), { timeout: 90000 }).toBe(true);
  await expect(page.locator('[data-testid=loading]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__game.getState().raceTimeSeconds), { timeout: 30000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
