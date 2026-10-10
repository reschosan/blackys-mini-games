import { expect, test } from '@playwright/test';

test.setTimeout(120000);

const NEW_MAPS = [
  { index: 3, name: 'Bauernhof', file: 'farm' },
  { index: 4, name: 'Mittelalterstadt', file: 'town' },
  { index: 5, name: 'Großstadt bei Nacht', file: 'city' },
] as const;

for (const { index, name, file } of NEW_MAPS) {
  test(`${name} renders its models and stays playable in the browser`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
    expect(await page.evaluate((mapIndex) => window.__game.startEnduranceRace(mapIndex, false), index)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 60000 }).toBe(true);
    const state = await page.evaluate(() => window.__game.getState());
    expect(state.mapName).toBe(name);
    expect(state.karts.length).toBe(4);
    await page.waitForTimeout(1500);
    await page.locator('.lil-gui.root').evaluate((panel) => {
      (panel as HTMLElement).style.display = 'none';
    });
    await page.screenshot({ path: `artifacts/${file}-course-browser.png` });
    expect(errors).toEqual([]);
  });

  test(`${name} remains visible at a mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
    expect(await page.evaluate((mapIndex) => window.__game.startEnduranceRace(mapIndex, false), index)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game.getState().houseModelLoaded), { timeout: 60000 }).toBe(true);
    await page.locator('.lil-gui.root').evaluate((panel) => {
      (panel as HTMLElement).style.display = 'none';
    });
    await page.screenshot({ path: `artifacts/${file}-course-mobile.png` });
    expect(await page.evaluate(() => window.__game.getState().karts.length)).toBe(4);
    const cardBounds = await page.locator('c-hud-card').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().right));
    expect(cardBounds).toHaveLength(4);
    expect(Math.max(...cardBounds)).toBeLessThanOrEqual(390);
  });

  test(`${name} remains navigable past its first bends`, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
    expect(await page.evaluate((mapIndex) => window.__game.startEnduranceRace(mapIndex, true), index)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game.getState().raceTimeSeconds), { timeout: 90000 }).toBeGreaterThan(30);
    const state = await page.evaluate(() => window.__game.getState());
    expect(state.karts.some((kart) => kart.nextCheckpoint !== 1 || kart.lap >= 1)).toBe(true);
    await page.locator('.lil-gui.root').evaluate((panel) => {
      (panel as HTMLElement).style.display = 'none';
    });
    await page.screenshot({ path: `artifacts/${file}-course-midlap.png` });
  });
}
