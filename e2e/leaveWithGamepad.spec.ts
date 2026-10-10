import { expect, test, type Page } from '@playwright/test';
import { chooseDefaultGame, joinWithGamepad, openGame, PAD, playerCount, tapButton } from './support/gamepad';

async function moveDownTo(page: Page, rowId: string): Promise<void> {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    if ((await page.locator('[data-row-id][active]').first().getAttribute('data-row-id')) === rowId) return;
    await tapButton(page, PAD.DOWN);
  }
  throw new Error(`row ${rowId} not reached`);
}

test('a gamepad player leaves with the last row and confirm, and can join again', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  expect(await playerCount(page)).toBe(1);

  await moveDownTo(page, 'leave');
  await expect(page.locator('[data-slot=player] c-button[data-row-id=leave]')).toHaveAttribute('active', '');
  await tapButton(page, PAD.CROSS);

  await expect(page.locator('[data-slot=player]')).toHaveCount(0);
  expect(await playerCount(page)).toBe(0);

  await joinWithGamepad(page);
  expect(await playerCount(page)).toBe(1);
});

test('confirm on the ready row still only toggles ready and never leaves', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await moveDownTo(page, 'ready');
  await tapButton(page, PAD.CROSS);

  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  expect(await playerCount(page)).toBe(1);
});

test('"Zurück" is the option after the last game and returns everyone to the lobby with the gamepad', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await moveDownTo(page, 'ready');
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await page.locator('c-button[data-back-button][active]').count()) > 0) break;
    await tapButton(page, PAD.RIGHT);
  }
  await expect(page.locator('c-button[data-back-button][active]')).toHaveCount(1);
  await expect(page.locator('[data-testid=game-vote] c-chip')).toHaveCount(1);
  await tapButton(page, PAD.CROSS);

  await expect(page.locator('[data-testid=game-vote]')).toBeHidden();
  await expect(page.locator('[data-testid=lobby]')).toBeVisible();
  await expect(page.locator('[data-slot=player] c-button[data-row-id=ready]')).toHaveAttribute('label', 'Bereit');
});

test('"Zurück" is the option after the last map and returns everyone to the game vote with the gamepad', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await moveDownTo(page, 'ready');
  await tapButton(page, PAD.CROSS);
  await chooseDefaultGame(page);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await page.locator('[data-testid=map-vote] c-button[data-back-button][active]').count()) > 0) break;
    await tapButton(page, PAD.RIGHT);
  }
  await expect(page.locator('[data-testid=map-vote] c-button[data-back-button][active]')).toHaveCount(1);
  await expect(page.locator('[data-testid=map-vote] c-chip')).toHaveCount(1);
  await tapButton(page, PAD.CROSS);

  await expect(page.locator('[data-testid=map-vote]')).toBeHidden();
  await expect(page.locator('[data-testid=game-vote]')).toBeVisible();
});
