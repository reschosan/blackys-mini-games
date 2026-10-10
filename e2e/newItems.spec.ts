import { expect, test } from '@playwright/test';
import { chooseDefaultGame, holdButton, installFakeGamepads, joinWithGamepad, PAD, RACE_START_LOCK_MS, tapButton } from './support/gamepad';

/** Naturpfad is the map behind the lobby and its box list is already built, so the forced box is placed on the Mondbasis, two cards to the right in the vote. */
const SPACE_MAP_VOTE_STEPS = 2;

type WorldItemKey = 'yarnBalls' | 'lasers' | 'gravityBubbles' | 'vacuumPulses' | 'traps';

const CASES: readonly { name: string; item: string; worldItem: WorldItemKey }[] = [
  { name: 'Laserpointer', item: 'laser', worldItem: 'lasers' },
  { name: 'Wollknäuel', item: 'yarn', worldItem: 'yarnBalls' },
  { name: 'Staubsauger', item: 'vacuum', worldItem: 'vacuumPulses' },
  { name: 'Schwerkraftblase', item: 'gravity', worldItem: 'gravityBubbles' },
  { name: 'Kuhfladen', item: 'cowpat', worldItem: 'traps' },
];

for (const { name, item, worldItem } of CASES) {
  test(`${name}: Gamepad-Spieler nimmt es auf, setzt es mit Quadrat ein, Kisten bleiben fehlerfrei`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await installFakeGamepads(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.evaluate(async (forcedItem) => {
      // A long-running dev server serves hot-updated modules under "?t=…"; patch the instance the game loaded.
      const loadedUrl = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => name.includes('/src/games/kart/maps/space/map.ts'));
      const { SPACE } = await import(/* @vite-ignore */ loadedUrl ?? '/src/games/kart/maps/space/map.ts');
      const start = SPACE.startPositions[0];
      Object.assign(SPACE, { mapItems: [forcedItem] });
      Object.assign(SPACE.itemBoxes[0], {
        x: start.x + Math.cos(start.yaw) * 6,
        z: start.z + Math.sin(start.yaw) * 6,
        levelId: start.levelId,
        item: forcedItem,
        heightOffset: 0,
      });
    }, item);

    await joinWithGamepad(page);
    await tapButton(page, PAD.CROSS);
    await chooseDefaultGame(page);
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
    for (let step = 0; step < SPACE_MAP_VOTE_STEPS; step += 1) await tapButton(page, PAD.RIGHT);
    await tapButton(page, PAD.CROSS);
    await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 30000 });
    expect(await page.evaluate(() => window.__game.getState().mapName)).toBe('Mondbasis');
    await page.waitForTimeout(RACE_START_LOCK_MS);
    await holdButton(page, PAD.CROSS, true);
    await expect.poll(() => page.evaluate(() => window.__game.getState().karts[0]!.heldItem), { timeout: 8000 }).toBe(item);
    await tapButton(page, PAD.SQUARE);
    await holdButton(page, PAD.CROSS, false);

    expect(await page.evaluate(() => window.__game.getState().karts[0]!.heldItem)).toBeNull();
    expect((await page.evaluate(() => window.__game.getState().worldItems))[worldItem]).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
