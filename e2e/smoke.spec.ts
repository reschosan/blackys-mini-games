import { expect, test } from '@playwright/test';
import { holdButton, openGame, PAD, phaseOf, playerCount, RACE_START_LOCK_MS, startRaceWithGamepad, tapButton } from './support/gamepad';

test.beforeEach(async ({ page }) => {
  await openGame(page);
});

test('starts in the lobby with no players', async ({ page }) => {
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.phase).toBe('lobby');
  expect(state.playerCount).toBe(0);
  await expect(page.locator('[data-testid=lobby]')).toBeVisible();
  await expect(page.locator('[data-slot]')).toHaveCount(4);
});

test('a gamepad player joins, starts a race and drives', async ({ page }) => {
  await startRaceWithGamepad(page);
  expect(await playerCount(page)).toBe(1);
  expect(await phaseOf(page)).toBe('racing');
  await expect(page.locator('c-hud-card')).toHaveCount(1);

  await page.waitForTimeout(RACE_START_LOCK_MS);
  const before = await page.evaluate(() => window.__game.getState().karts[0]);
  await holdButton(page, PAD.CROSS, true);
  await page.waitForTimeout(1000);
  await holdButton(page, PAD.CROSS, false);
  const after = await page.evaluate(() => window.__game.getState().karts[0]);

  expect(after?.speed).toBeGreaterThan(1);
  expect(Math.hypot((after?.x ?? 0) - (before?.x ?? 0), (after?.z ?? 0) - (before?.z ?? 0))).toBeGreaterThan(1);
  expect(after?.lap).toBe(0);
});

test('pauses and resumes a running race', async ({ page }) => {
  await startRaceWithGamepad(page);
  expect(await phaseOf(page)).toBe('racing');

  await tapButton(page, PAD.START);
  expect(await phaseOf(page)).toBe('paused');
  await expect(page.locator('[data-testid=menu]')).toBeVisible();

  await tapButton(page, PAD.START);
  expect(await phaseOf(page)).toBe('racing');
});

test('returns from the pause menu to an empty lobby', async ({ page }) => {
  await startRaceWithGamepad(page);
  await tapButton(page, PAD.START);

  for (let step = 0; step < 4; step += 1) await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.CROSS);

  await expect.poll(() => phaseOf(page)).toBe('lobby');
  expect(await playerCount(page)).toBe(0);
});

test('logs no console errors while loading and racing', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));

  await startRaceWithGamepad(page);
  await holdButton(page, PAD.CROSS, true);
  await page.waitForTimeout(800);
  await holdButton(page, PAD.CROSS, false);

  expect(problems).toEqual([]);
});
