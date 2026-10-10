import { expect, test, type Page } from '@playwright/test';
import { GAME_IDS } from './support/gameCount';
import { joinWithGamepad, openGame, PAD, phaseOf, tapButton } from './support/gamepad';

// after the vote the card shows what the chosen game needs: the kart, the plane, or nothing (memory, lava on foot).

async function voteFor(page: Page, gameId: (typeof GAME_IDS)[number]): Promise<void> {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  for (let step = 0; step < GAME_IDS.indexOf(gameId); step += 1) await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.CROSS);
}

const rowIds = (page: Page): Promise<(string | null)[]> =>
  page.locator('[data-testid=lobby] [data-slot=player] [data-row-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-row-id')));

test('before the vote the card only has the preset of the cat: no other cat rows, no kart, no plane', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  expect(await rowIds(page)).toEqual(['preset', 'ready', 'leave']);
});

test('a game with karts shows the kart rows, "Zurück" goes back to the vote and ready goes on', async ({ page }) => {
  await voteFor(page, 'race');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  const kartRows = await rowIds(page);
  expect(kartRows).toContain('furColor');
  expect(kartRows.slice(-5)).toEqual(['kartType', 'wheels', 'kartColor', 'ready', 'leave']);
  await expect(page.locator('[data-testid=lobby] c-button[data-row-id=leave]')).toHaveAttribute('label', 'Zurück');
  await expect(page.locator('[data-testid=lobby] c-stat-bars')).toHaveCount(1);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
});

test('the fighter jets show the plane rows and the short names change with the stick', async ({ page }) => {
  await voteFor(page, 'jets');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=planeType]', { state: 'visible', timeout: 5000 });
  expect(await rowIds(page)).toEqual(['planeType', 'ready', 'leave']);
  const plane = page.locator('[data-testid=lobby] c-setting-row[data-row-id=planeType]');
  await expect(plane).toHaveAttribute('value', 'Jet');
  const seen: (string | null)[] = [];
  for (let press = 0; press < 4; press += 1) {
    await tapButton(page, PAD.RIGHT);
    seen.push(await plane.getAttribute('value'));
  }
  expect(seen).toEqual(['Flitzer', 'UFO', 'Liner', 'Jet']);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.CROSS);
  await expect.poll(() => phaseOf(page), { timeout: 10_000 }).toBe('racing');
  // A player who is alone gets AI pilots: a dogfight with nobody is no game.
  const pilots = await page.evaluate(() => (window.__game.getState().engineState as unknown as { jets: number[][] }).jets.length);
  expect(pilots).toBe(4);
});

test('memory asks for the level on the card and the board has that many pairs', async ({ page }) => {
  await voteFor(page, 'memory');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=memoryLevel]', { state: 'visible', timeout: 5000 });
  const level = page.locator('[data-testid=lobby] c-setting-row[data-row-id=memoryLevel]');
  await expect(level).toHaveAttribute('value', '7 Paare');
  const seen: (string | null)[] = [];
  for (let press = 0; press < 4; press += 1) {
    await tapButton(page, PAD.RIGHT);
    seen.push(await level.getAttribute('value'));
  }
  expect(seen).toEqual(['10 Paare', '12 Paare', '5 Paare', '7 Paare']);
  await tapButton(page, PAD.LEFT);
  await expect(level).toHaveAttribute('value', '5 Paare');
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.CROSS);
  await expect.poll(() => phaseOf(page), { timeout: 10_000 }).toBe('racing');
  await expect(page.locator('[data-testid=memory-board] c-memory-card')).toHaveCount(10);
});

test('lava on foot shows the whole cat (no kart) after the vote and starts when ready', async ({ page }) => {
  await voteFor(page, 'walk');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=furColor]', { state: 'visible', timeout: 5000 });
  const rows = await rowIds(page);
  expect(rows).not.toContain('kartType');
  expect(rows.slice(-2)).toEqual(['ready', 'leave']);
  await tapButton(page, PAD.CROSS);
  await expect.poll(() => phaseOf(page), { timeout: 10_000 }).toBe('racing');
});
