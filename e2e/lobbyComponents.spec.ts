import { expect, test, type Page } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, tapButton } from './support/gamepad';

// The lobby re-renders every frame, so clicks go by coordinates instead of a stable element.
async function clickAt(page: Page, selector: string, index = 0): Promise<void> {
  const point = await page.evaluate(
    ({ selector, index }) => {
      const rect = document.querySelectorAll(selector)[index]!.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    { selector, index },
  );
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
}

async function openLobby(page: Page): Promise<void> {
  await openGame(page, 2);
}

async function joinTwoGamepads(page: Page): Promise<void> {
  await joinWithGamepad(page, 0);
  await joinWithGamepad(page, 1);
}

/** Two players (the first with the mouse, the second with a pad) lock in the first game. */
async function passGameVote(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-testid=game-vote] c-map-vote-card', 0);
  await clickAt(page, '[data-testid=game-vote] c-map-vote-card', 0);
  await tapButton(page, PAD.CROSS, 1);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
}

test('the lobby sound checkbox toggles the muted setting and keeps it', async ({ page }) => {
  await openLobby(page);
  const muted = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('catkart:audio') ?? '{}').muted);

  await clickAt(page, 'c-checkbox[data-audio-toggle] input');
  expect(await muted()).toBe(false);
  await clickAt(page, 'c-checkbox[data-audio-toggle] input');
  expect(await muted()).toBe(true);
});

test('two gamepad players join and one edits their own cat with the mouse', async ({ page }) => {
  await openLobby(page);

  await joinTwoGamepads(page);
  await expect(page.locator('[data-slot=player]')).toHaveCount(2);

  const presetOf = (player: number) => page.locator(`[data-player-index="${player}"] c-setting-row[data-row-id=preset]`);
  const secondPlayerRow = '[data-player-index="1"] c-setting-row';
  const firstBefore = await presetOf(0).getAttribute('value');
  const secondBefore = await presetOf(1).getAttribute('value');
  await clickAt(page, `${secondPlayerRow}[data-row-id=preset] [data-arrow=right]`);
  expect(await presetOf(1).getAttribute('value')).not.toBe(secondBefore);
  expect(await presetOf(0).getAttribute('value')).toBe(firstBefore);

  await expect(page.locator(`${secondPlayerRow}[data-row-id=preset]`)).toHaveAttribute('active', '');
  await expect(page.locator('[data-player-index="0"] c-setting-row[data-row-id=preset]')).toHaveAttribute('active', '');
});

test('ready buttons switch between Bereit and Nicht bereit and both players start the vote together', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);

  const ready = (player: number) => page.locator(`[data-player-index="${player}"] c-button[data-row-id=ready]`);
  await expect(ready(0)).toHaveAttribute('label', 'Bereit');
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await expect(ready(0)).toHaveAttribute('label', 'Nicht bereit');
  await expect(ready(0)).toHaveAttribute('mode', 'success');
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await expect(ready(0)).toHaveAttribute('label', 'Bereit');

  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
  await passGameVote(page);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });

  await clickAt(page, 'c-map-vote-card', 2);
  await expect(page.locator('c-map-vote-card').nth(2).locator('c-chip')).toHaveCount(1);
  await clickAt(page, 'c-map-vote-card', 2);
  await tapButton(page, PAD.CROSS, 1);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
});

test('the hud shows one card per player and stays inside a phone-sized viewport', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
  await passGameVote(page);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, 'c-map-vote-card', 0);
  await clickAt(page, 'c-map-vote-card', 0);
  await tapButton(page, PAD.CROSS, 1);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  await expect(page.locator('c-hud-card')).toHaveCount(2);
  const bounds = await page.locator('c-hud-card, c-hud-timer').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().right));
  for (const right of bounds) expect(right).toBeLessThanOrEqual(390);
});

test('a player who leaves frees the slot, later players move up and keep their cat', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  const nameOf = (player: number) => page.locator(`[data-player-index="${player}"] c-setting-row[data-row-id=preset]`).getAttribute('value');
  const secondName = await nameOf(1);
  const secondTag = ((await page.locator('[data-player-index="1"] c-player-tag').textContent()) ?? '').trim();

  await clickAt(page, '[data-player-index="0"] [data-leave-button]');

  await expect(page.locator('[data-slot=player]')).toHaveCount(1);
  expect(await nameOf(0)).toBe(secondName);
  await expect(page.locator('[data-player-index="0"] c-player-tag')).toHaveText(secondTag);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);
});

test('when the only player who was not ready leaves, the ready ones go on to the game vote', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');

  await clickAt(page, '[data-player-index="0"] [data-leave-button]');

  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
});

test('leaving keeps the number of AI opponents and the last player leaving clears the lobby', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  await clickAt(page, '[data-ai-fill-button]');
  await expect(page.locator('[data-ai-fill-button]')).toHaveAttribute('label', 'KI-Gegner: 1');

  await clickAt(page, '[data-player-index="0"] [data-leave-button]');
  await expect(page.locator('[data-ai-fill-button]')).toHaveAttribute('label', 'KI-Gegner: 1');

  await clickAt(page, '[data-player-index="0"] [data-leave-button]');
  await expect(page.locator('[data-slot=player]')).toHaveCount(0);
  await expect(page.locator('[data-ai-fill-button]')).toHaveCount(0);
  await expect(page.locator('[data-slot=empty]')).toHaveCount(4);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(0);
});

test('Zurück in the game vote returns everyone to the customization, not ready', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-testid=game-vote] c-map-vote-card', 1);

  await clickAt(page, '[data-testid=game-vote] [data-back-button]');

  await expect(page.locator('[data-testid=game-vote]')).toBeHidden();
  await expect(page.locator('[data-testid=lobby]')).toBeVisible();
  for (const player of [0, 1]) {
    await expect(page.locator(`[data-player-index="${player}"] c-button[data-row-id=ready]`)).toHaveAttribute('label', 'Bereit');
  }
  await page.waitForTimeout(500);
  await expect(page.locator('[data-testid=game-vote]')).toBeHidden();

  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await expect(page.locator('[data-testid=game-vote] c-chip')).toHaveCount(2);
});

test('Zurück in the map vote returns everyone to the game vote, votes dropped', async ({ page }) => {
  await openLobby(page);
  await joinTwoGamepads(page);
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await clickAt(page, '[data-player-index="1"] c-button[data-row-id=ready]');
  await passGameVote(page);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-testid=map-vote] c-map-vote-card', 1);

  await clickAt(page, '[data-testid=map-vote] [data-back-button]');

  await expect(page.locator('[data-testid=map-vote]')).toBeHidden();
  await expect(page.locator('[data-testid=game-vote]')).toBeVisible();
  await expect(page.locator('[data-testid=game-vote] c-chip')).toHaveCount(2);
});
