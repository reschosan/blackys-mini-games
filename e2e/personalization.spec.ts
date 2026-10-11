import { expect, test } from '@playwright/test';
import { goToRow, joinWithGamepad, openFullCard, openGame, PAD, playerCount, tapButton } from './support/gamepad';

// The cat is made on the card of a kart game (the whole card: cat and kart); before the vote the card only has the preset.

const activeRowOf = (page: import('@playwright/test').Page) => page.locator('[data-slot=player]').first().locator('[data-row-id][active]');

test('lobby personalization: row/value navigation, ready-gating, persistence', async ({ page }) => {
  await openGame(page);

  await joinWithGamepad(page);
  expect(await playerCount(page)).toBe(1);
  const activeRow = activeRowOf(page);
  await expect(activeRow).toHaveAttribute('label', 'Vorlage');

  await openFullCard(page);
  await goToRow(page, 'furColor');
  await expect(activeRow).toHaveAttribute('label', 'Fellfarbe');
  const valueBefore = await activeRow.getAttribute('value');
  await tapButton(page, PAD.RIGHT);
  const valueAfter = await activeRow.getAttribute('value');
  expect(valueAfter).not.toBe(valueBefore);

  // The cross sets "Ready" on any row; the map vote starts once everyone is ready.
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });

  // Persistence: the gamepad player's chosen fur color survives a reload.
  const saved = await page.evaluate(() => window.localStorage.getItem('blackys-mini-games:cat:gamepad:0'));
  expect(saved).not.toBeNull();
  const savedFurColor = JSON.parse(saved ?? '{}').furColor as string;

  await page.reload();
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'furColor');
  const restoredValue = await activeRowOf(page).getAttribute('value');
  expect(restoredValue?.toLowerCase()).toContain(
    { black: 'schwarz', white: 'weiß', gray: 'grau', red: 'rot', cream: 'creme', brown: 'braun' }[
      savedFurColor as 'black' | 'white' | 'gray' | 'red' | 'cream' | 'brown'
    ],
  );
});

test('long hair: the "Haarlänge" row switches the cat to long hair, saves it and shows it after a reload', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'hairLength');
  const activeRow = activeRowOf(page);
  await expect(activeRow).toHaveAttribute('label', 'Haarlänge');
  await expect(activeRow).toHaveAttribute('value', 'Kurz');

  await tapButton(page, PAD.RIGHT);
  await expect(activeRow).toHaveAttribute('value', 'Lang');
  const saved = await page.evaluate(() => window.localStorage.getItem('blackys-mini-games:cat:gamepad:0'));
  expect(JSON.parse(saved ?? '{}').hairLength).toBe('long');

  await page.reload();
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'hairLength');
  await expect(activeRowOf(page)).toHaveAttribute('value', 'Lang');
});

test('mane: the "Mähne" row cycles none, Kragen and Löwenmähne, saves the choice and keeps it after a reload', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'mane');
  const activeRow = activeRowOf(page);
  await expect(activeRow).toHaveAttribute('label', 'Mähne');
  await expect(activeRow).toHaveAttribute('value', 'Keine');

  await tapButton(page, PAD.RIGHT);
  await expect(activeRow).toHaveAttribute('value', 'Kragen');
  await tapButton(page, PAD.RIGHT);
  await expect(activeRow).toHaveAttribute('value', 'Löwenmähne');
  const saved = await page.evaluate(() => window.localStorage.getItem('blackys-mini-games:cat:gamepad:0'));
  expect(JSON.parse(saved ?? '{}').mane).toBe('lion');

  await page.reload();
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'mane');
  await expect(activeRowOf(page)).toHaveAttribute('value', 'Löwenmähne');
});
