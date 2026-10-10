import { devices, expect, test, type Page } from '@playwright/test';
import { GAME_IDS } from './support/gameCount';
import { chooseDefaultVehicle, holdButton, joinWithGamepad, openGame, PAD, phaseOf, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation } from './support/remoteGuest';

// groups A and B: the games on the kart engine (drift challenge, tag, sumo, lava, soccer), alone and on a guest phone.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });

const KART_GAMES = ['drift', 'tag', 'sumo', 'lavakart', 'soccer'] as const;
const ARENA_NAMES: Readonly<Record<string, string>> = { tag: 'Fangen-Arena', sumo: 'Sumo-Plattform', lavakart: 'Lavaboden', soccer: 'Fußballfeld' };

async function lobby(page: Page): Promise<void> {
  await openGame(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
}

for (const id of KART_GAMES) {
  test(`${id}: four AI karts play the whole game, the results say how each one did`, async ({ page }) => {
    await lobby(page);
    expect(await page.evaluate((game) => window.__game.startGameForTest(game, true), id)).toBe(true);
    await expect.poll(() => phaseOf(page), { timeout: 120_000 }).toBe('results');
    const state = await page.evaluate(() => window.__game.getState());
    expect(state.gameId).toBe(id);
    if (ARENA_NAMES[id]) expect(state.mapName).toBe(ARENA_NAMES[id]);
    await expect(page.locator('[data-testid=menu] c-result-row')).toHaveCount(4);
    const times = await page.locator('[data-testid=menu] c-result-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('time')));
    expect(times.every((time) => time !== null && time !== '—' && time.length > 0)).toBe(true);
  });
}

test('a game on an arena skips the map vote and starts on its own ground', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  const sumo = GAME_IDS.indexOf('sumo');
  for (let step = 0; step < sumo; step += 1) await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.CROSS);
  await chooseDefaultVehicle(page);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 10_000 });
  expect(await page.locator('[data-testid=map-vote]').isVisible()).toBe(false);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.mapName).toBe('Sumo-Plattform');
  expect(state.gameId).toBe('sumo');
});

test('the drift challenge shows the time and the points of the player while it runs', async ({ page }) => {
  await lobby(page);
  await page.evaluate(() => window.__game.startGameForTest('drift', false));
  await page.waitForFunction(() => window.__game.getState().raceTimeSeconds > 1);
  await expect(page.locator('[data-testid=hud] c-hud-timer')).toContainText('Zeit');
  await expect(page.locator('[data-testid=hud] c-hud-card').first()).toHaveAttribute('status', /Punkte/);
});

test('sumo: karts that fall off the platform disappear and the platform shrinks', async ({ page }) => {
  await lobby(page);
  await page.evaluate(() => window.__game.startGameForTest('sumo', true));
  await expect.poll(async () => (await page.evaluate(() => window.__game.getState().outSeats)).length, { timeout: 60_000 }).toBeGreaterThan(0);
  const lines = await page.evaluate(() => window.__game.getState().statusLines);
  expect(lines.join(' ')).toMatch(/Plattform/);
});

test('sumo: the item button (Quadrat) is a shove; the card says when it is ready again', async ({ page }) => {
  await lobby(page);
  await joinWithGamepad(page);
  await page.evaluate(() => window.__game.startGameForTest('sumo', false));
  await page.waitForFunction(() => window.__game.getState().raceTimeSeconds > 0.5, undefined, { timeout: 20_000 });
  const card = page.locator('[data-testid=hud] c-hud-card').first();
  await expect(card).toHaveAttribute('status', 'Stoß bereit');
  await expect
    .poll(async () => {
      await holdButton(page, PAD.SQUARE, true);
      await page.waitForTimeout(300);
      await holdButton(page, PAD.SQUARE, false);
      return card.getAttribute('status');
    })
    .toBe('Stoß lädt …');
  await expect(card).toHaveAttribute('status', 'Stoß bereit', { timeout: 5000 });
});

test('sumo on a phone: the item button of the on-screen controls is called "Stoß"', async ({ browser }) => {
  const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13'];
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  await page.locator('#pad-ok').tap();
  await page.evaluate(() => window.__game.startGameForTest('sumo', false));
  await expect(page.locator('#btn-item button')).toHaveText('Stoß', { timeout: 20_000 });
  await context.close();
});

test.describe('on a guest phone with its own screen', () => {
  test.setTimeout(120_000);

  for (const id of ['sumo', 'soccer', 'lavakart', 'tag'] as const) {
    test(`${id}: the guest draws the same game and knows who is out`, async ({ browser }) => {
      const { host, context } = await newHostAndContext(browser, false, true);
      await openInvitation(host);
      const guest = await connectGuest(host, context);
      await closeInvitation(host);
      await expect(guest.locator('[data-testid=guest-lobby] c-cat-preview-card')).toBeVisible({ timeout: 20_000 });
      expect(await host.evaluate((game) => window.__game.startGameForTest(game, false), id)).toBe(true);
      await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, {
        timeout: 60_000,
      });
      await expect
        .poll(
          async () => {
            const [hostState, guestState] = await Promise.all([
              host.evaluate(() => window.__game.getState()),
              guest.evaluate(() => (window.__guest!.getState() as { race: { gameId: string; statusLines: string[]; outSeats: number[] } }).race),
            ]);
            return (
              guestState.gameId === id &&
              hostState.statusLines.length > 0 &&
              guestState.statusLines.join('|') === hostState.statusLines.join('|') &&
              guestState.outSeats.join(',') === hostState.outSeats.join(',')
            );
          },
          { timeout: 30_000, intervals: [500] },
        )
        .toBe(true);
      if (id === 'sumo') await expect(guest.locator('#btn-item button')).toHaveText('Stoß');
      await context.close();
    });
  }
});
