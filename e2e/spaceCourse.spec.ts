import { expect, test } from '@playwright/test';

test.setTimeout(120000);

const SPACE_MAP_INDEX = 2;

test('space course renders its assets and stays playable in the browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate((index) => window.__game.startEnduranceRace(index, false), SPACE_MAP_INDEX)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 60000 }).toBe(true);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.mapName).toBe('Mondbasis');
  expect(state.karts.length).toBe(4);
  await page.waitForTimeout(1500);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/space-course-browser.png' });
  expect(errors).toEqual([]);
});

test('space course remains visible at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate((index) => window.__game.startEnduranceRace(index, false), SPACE_MAP_INDEX)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 60000 }).toBe(true);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/space-course-mobile.png' });
  expect(await page.evaluate(() => window.__game.getState().karts.length)).toBe(4);
  const cardBounds = await page.locator('c-hud-card').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().right));
  expect(cardBounds).toHaveLength(4);
  expect(Math.max(...cardBounds)).toBeLessThanOrEqual(390);
});

test('space course remains navigable past its first hairpins', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate((index) => window.__game.startEnduranceRace(index, true), SPACE_MAP_INDEX)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().raceTimeSeconds), { timeout: 90000 }).toBeGreaterThan(35);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.karts.some((kart) => kart.nextCheckpoint >= 2)).toBe(true);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/space-course-midlap.png' });
});
