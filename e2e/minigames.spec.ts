import { expect, test, type Page } from '@playwright/test';
import { GAME_COUNT } from './support/gameCount';
import { chooseDefaultVehicle, joinWithGamepad, moveMenuCursorTo, openGame, PAD, phaseOf, RACE_START_LOCK_MS, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation } from './support/remoteGuest';

// choosing the game, the time trial without items, and the score over several games.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });

const GAME_VOTE = '[data-testid=game-vote]';
const MAP_VOTE = '[data-testid=map-vote]';

async function readyUp(page: Page): Promise<void> {
  await joinWithGamepad(page);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector(GAME_VOTE, { state: 'visible', timeout: 5000 });
}

async function raceOn(page: Page, gameSteps: number): Promise<void> {
  for (let step = 0; step < gameSteps; step += 1) await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.CROSS);
  await chooseDefaultVehicle(page);
  await page.waitForSelector(MAP_VOTE, { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 10000 });
}

async function showResults(page: Page): Promise<void> {
  await page.waitForTimeout(RACE_START_LOCK_MS);
  await page.evaluate(() => window.__game.showResultsForTest());
  await expect.poll(() => phaseOf(page)).toBe('results');
}

/** Moves the cursor of the result page down to the option and confirms it; a key that is pressed too early is lost, so both repeat until they take effect. */
async function chooseResult(page: Page, optionId: 'again' | 'next' | 'lobby'): Promise<void> {
  await moveMenuCursorTo(page, optionId);
  await expect
    .poll(
      async () => {
        await tapButton(page, PAD.CROSS);
        return phaseOf(page);
      },
      { timeout: 10_000 },
    )
    .not.toBe('results');
}

const scoreOfFirstRow = (page: Page): Promise<string | null> => page.locator('[data-testid=menu] c-result-row').first().getAttribute('score');

test('the game vote offers the race first and the time trial second, with the race under the cursor', async ({ page }) => {
  await openGame(page);
  await readyUp(page);
  await expect(page.locator(`${GAME_VOTE} c-map-vote-card`)).toHaveCount(GAME_COUNT);
  await expect(page.locator(`${GAME_VOTE} c-map-vote-card`).nth(0)).toContainText('Rennen');
  await expect(page.locator(`${GAME_VOTE} c-map-vote-card`).nth(1)).toContainText('Zeitfahren');
  await expect(page.locator(`${GAME_VOTE} c-map-vote-card`).first().locator('c-chip')).toHaveCount(1);
  await expect(page.locator(`${GAME_VOTE} c-map-vote-card`).last().locator('c-chip')).toHaveCount(0);
});

test('the race keeps its item boxes and its laps', async ({ page }) => {
  await openGame(page);
  await readyUp(page);
  await raceOn(page, 0);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.lapCount).toBeGreaterThan(1);
  expect(state.worldItems.itemBoxesAvailable).toBeGreaterThan(0);
});

test('the time trial is one lap without item boxes, and the map screen tells how it is played', async ({ page }) => {
  await openGame(page);
  await readyUp(page);
  await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.CROSS);
  await chooseDefaultVehicle(page);
  await page.waitForSelector(MAP_VOTE, { state: 'visible', timeout: 5000 });
  await expect(page.locator(`${MAP_VOTE} [data-game-rules]`)).toContainText('Zeitfahren');
  await expect(page.locator(`${MAP_VOTE} [data-game-rules]`)).toContainText('keine Items');
  await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 10000 });
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.lapCount).toBe(1);
  expect(state.worldItems.itemBoxesAvailable).toBe(0);
});

test('a race after the time trial has its laps and boxes again', async ({ page }) => {
  await openGame(page);
  await readyUp(page);
  await raceOn(page, 1);
  expect((await page.evaluate(() => window.__game.getState())).lapCount).toBe(1);
  await showResults(page);
  await chooseResult(page, 'next');
  await page.waitForSelector(GAME_VOTE, { state: 'visible', timeout: 5000 });
  await raceOn(page, 0);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.lapCount).toBeGreaterThan(1);
  expect(state.worldItems.itemBoxesAvailable).toBeGreaterThan(0);
});

test('the result page shows the points, "Nächstes Spiel" keeps the total and the lobby clears it', async ({ page }) => {
  await openGame(page);
  await readyUp(page);
  await raceOn(page, 0);
  await showResults(page);
  await expect(page.locator('[data-testid=menu] [data-option-id]')).toHaveText(['Nochmal', 'Nächstes Spiel', 'Zurück zur Lobby']);
  expect(await scoreOfFirstRow(page)).toBe('+1 · 1');

  await chooseResult(page, 'next');
  await page.waitForSelector(GAME_VOTE, { state: 'visible', timeout: 5000 });
  expect(await playerCountOf(page)).toBe(1);
  await raceOn(page, 0);
  await showResults(page);
  expect(await scoreOfFirstRow(page)).toBe('+1 · 2');

  await chooseResult(page, 'again');
  await expect.poll(() => phaseOf(page)).toBe('racing');
  await showResults(page);
  expect(await scoreOfFirstRow(page)).toBe('+1 · 3');

  await chooseResult(page, 'lobby');
  await expect.poll(() => phaseOf(page)).toBe('lobby');
  await readyUp(page);
  await raceOn(page, 0);
  await showResults(page);
  expect(await scoreOfFirstRow(page)).toBe('+1 · 1');
});

const playerCountOf = (page: Page): Promise<number> => page.evaluate(() => window.__game.getState().playerCount);

test('a guest may stay a plain controller only while the host screen can show a shared picture', async ({ browser }) => {
  test.setTimeout(120_000);
  const { host, context } = await newHostAndContext(browser, false, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await closeInvitation(host);
  await expect(guest.locator('[data-testid=guest-lobby] c-cat-preview-card')).toBeVisible({ timeout: 20_000 });
  await expect(guest.locator('[data-guest-view]')).toHaveCount(1);

  await host.setViewportSize({ width: 390, height: 844 });
  await expect(guest.locator('[data-guest-view]')).toHaveCount(0, { timeout: 10_000 });
  await host.setViewportSize({ width: 1280, height: 800 });
  await expect(guest.locator('[data-guest-view]')).toHaveCount(1, { timeout: 10_000 });
  await context.close();
});
