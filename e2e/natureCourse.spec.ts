import { expect, test } from '@playwright/test';

test.setTimeout(90000);

test('nature course renders its assets and stays playable in the browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate(() => window.__game.startEnduranceRace(0, false))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 30000 }).toBe(true);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.mapName).toBe('Naturpfad');
  expect(state.karts.length).toBe(4);
  expect(errors).toEqual([]);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/nature-course-browser.png' });
});

test('nature course remains visible at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate(() => window.__game.startEnduranceRace(0, false))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 30000 }).toBe(true);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/nature-course-mobile.png' });
  expect(await page.evaluate(() => window.__game.getState().karts.length)).toBe(4);
  const cardBounds = await page.locator('c-hud-card').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().right));
  expect(cardBounds).toHaveLength(4);
  expect(Math.max(...cardBounds)).toBeLessThanOrEqual(390);
});

test('nature course remains navigable past its first bends', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate(() => window.__game.startEnduranceRace(0, true))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().raceTimeSeconds), { timeout: 60000 }).toBeGreaterThan(35);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.karts.some((kart) => kart.nextCheckpoint >= 2)).toBe(true);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/nature-course-midlap.png' });
});
