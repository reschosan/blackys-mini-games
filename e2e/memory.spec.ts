import { devices, expect, test, type Page } from '@playwright/test';
import { GAME_IDS } from './support/gameCount';
import { joinWithGamepad, openGame, PAD, phaseOf, startRaceWithGamepad, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation } from './support/remoteGuest';

// memory, the first game that is not on the kart engine.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });

const BOARD = '[data-testid=memory-board] c-memory-card';

const cardStates = (page: Page, scope: string): Promise<(string | null)[]> =>
  page.locator(`${scope} c-memory-card`).evaluateAll((cards) => cards.map((card) => card.getAttribute('state')));

test('four AI cats play a whole game, the board shows the cards of the default level (seven pairs) and the results count the points (the golden pair is worth three)', async ({
  page,
}) => {
  await openGame(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  expect(await page.evaluate(() => window.__game.startGameForTest('memory', true))).toBe(true);
  await expect(page.locator(BOARD)).toHaveCount(14);
  await expect.poll(() => phaseOf(page), { timeout: 180_000 }).toBe('results');
  await expect(page.locator('[data-testid=menu] c-result-row')).toHaveCount(4);
  const pairs = await page
    .locator('[data-testid=menu] c-result-row')
    .evaluateAll((rows) => rows.map((row) => Number.parseInt(row.getAttribute('time') ?? '0', 10)));
  expect(pairs.reduce((sum, count) => sum + count, 0)).toBe(9);
  expect((await cardStates(page, '[data-testid=memory-board]')).every((state) => state === 'matched')).toBe(true);
});

test('after a kart game and "Nächstes Spiel" no start countdown of the race stays on the memory board', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await page.evaluate(() => window.__game.showResultsForTest());
  await page.locator('[data-testid=menu] [data-option-id="next"]').click();
  await expect.poll(() => phaseOf(page)).toBe('lobby');
  expect(await page.evaluate(() => window.__game.startGameForTest('memory', false))).toBe(true);
  await expect(page.locator(BOARD).first()).toBeVisible();
  await expect(page.locator('c-start-countdown')).toHaveCount(0, { timeout: 8000 });
});

test('a human cat flips a card with the cross and the game says whose turn it is', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  await page.evaluate(() => window.__game.startGameForTest('memory', false));
  await expect(page.locator(BOARD)).toHaveCount(14);
  await expect(page.locator('[data-testid=hud] c-hud-timer')).toContainText('ist dran');
  await expect
    .poll(
      async () => {
        await tapButton(page, PAD.CROSS);
        return (await cardStates(page, '[data-testid=memory-board]')).filter((state) => state === 'open').length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  const faces = await page
    .locator(BOARD)
    .evaluateAll((cards) => cards.filter((card) => card.getAttribute('state') !== 'hidden').map((card) => card.getAttribute('face')));
  expect(faces.every((face) => face && face.length > 0)).toBe(true);
});

test('a face down card never shows its face, not even in the page', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  await page.evaluate(() => window.__game.startGameForTest('memory', false));
  await expect(page.locator(BOARD)).toHaveCount(14);
  const hiddenFaces = await page.locator(`${BOARD}[state=hidden]`).evaluateAll((cards) => cards.map((card) => card.getAttribute('face')));
  expect(hiddenFaces.every((face) => face === '')).toBe(true);
});

test('memory is offered after the kart games', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await expect(page.locator('[data-testid=game-vote] c-map-vote-card').nth(GAME_IDS.indexOf('memory'))).toContainText('Memory');
});

test.describe('on a guest phone with its own screen', () => {
  test.setTimeout(120_000);

  test('the guest draws the same board as the host', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser, false, true);
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    await closeInvitation(host);
    await expect(guest.locator('[data-testid=guest-lobby] c-cat-preview-card')).toBeVisible({ timeout: 20_000 });
    expect(await host.evaluate(() => window.__game.startGameForTest('memory', false))).toBe(true);
    await expect(guest.locator('[data-testid=client-engine] c-memory-card')).toHaveCount(14, { timeout: 30_000 });
    await expect
      .poll(
        async () => {
          const [hostStates, guestStates] = await Promise.all([
            cardStates(host, '[data-testid=memory-board]'),
            cardStates(guest, '[data-testid=client-engine]'),
          ]);
          return hostStates.join() === guestStates.join();
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);
    await expect(guest.locator('[data-testid=hud] c-hud-timer')).toContainText('ist dran');
    await context.close();
  });

  test('the guest flips a card by tapping it on its own board', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser, false, true);
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    await closeInvitation(host);
    await expect(guest.locator('[data-testid=guest-lobby] c-cat-preview-card')).toBeVisible({ timeout: 20_000 });
    expect(await host.evaluate(() => window.__game.startGameForTest('memory', false))).toBe(true);
    await expect(guest.locator('[data-testid=client-engine] c-memory-card')).toHaveCount(14, { timeout: 30_000 });
    const memoryState = () => host.evaluate(() => window.__game.getState().engineState as unknown as { turn: number; phase: string; states: number[] });
    await expect
      .poll(
        async () => {
          const state = await memoryState();
          return state.turn === 1 && state.phase === 'first';
        },
        { timeout: 40_000 },
      )
      .toBe(true);
    const hidden = (await memoryState()).states.findIndex((value) => value === 0);
    await guest.locator(`[data-testid=client-engine] c-memory-card[data-pick-index="${hidden}"]`).tap();
    await expect.poll(async () => (await memoryState()).states[hidden], { timeout: 5000 }).toBe(1);
    await context.close();
  });
});

test.describe('on a phone with on-screen controls', () => {
  const { defaultBrowserType: _ignored, ...IPHONE } = devices['iPhone 13'];
  test.use({ ...IPHONE });

  test('a tap on a card flips it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__game?.getState().playerCount === 1);
    await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
    expect(await page.evaluate(() => window.__game.startGameForTest('memory', false))).toBe(true);
    await expect(page.locator(BOARD)).toHaveCount(14);
    const states = () => page.evaluate(() => (window.__game.getState().engineState as unknown as { states: number[] }).states);
    await expect.poll(async () => await page.evaluate(() => (window.__game.getState().engineState as unknown as { turn: number }).turn)).toBe(0);
    await page.locator(`${BOARD}[data-pick-index="5"]`).tap();
    await expect.poll(async () => (await states())[5]).toBe(1);
  });
});
