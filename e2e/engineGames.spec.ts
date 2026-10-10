import { devices, expect, test, type Page } from '@playwright/test';
import { holdButton, joinWithGamepad, openGame, PAD, phaseOf, setAxis, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation, tapElement } from './support/remoteGuest';

// lava on foot and the fighter jets, the games with their own 3D scene.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });

type Rows = number[][];

/** How far a cat has moved in the direction its camera looks (row: x, z, y, facing, out, moving, camera yaw). */
function forwardProgress(before: number[], now: number[]): number {
  return (now[0]! - before[0]!) * Math.sin(before[6]!) - (now[1]! - before[1]!) * Math.cos(before[6]!);
}

async function engineRows(page: Page, key: 'cats' | 'jets'): Promise<Rows> {
  return page.evaluate((name) => (window.__game.getState().engineState as unknown as Record<string, number[][]>)[name] ?? [], key);
}

for (const [id, detail] of [
  ['walk', /Letzte Katze|gefallen nach/],
  ['jets', /Letzter Pilot|Treffer|raus nach/],
] as const) {
  test(`${id}: four AI cats play the whole game and the results say how each did`, async ({ page }) => {
    await openGame(page);
    await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
    expect(await page.evaluate((game) => window.__game.startGameForTest(game, true), id)).toBe(true);
    await expect.poll(() => phaseOf(page), { timeout: 180_000 }).toBe('results');
    await expect(page.locator('[data-testid=menu] c-result-row')).toHaveCount(4);
    const times = await page.locator('[data-testid=menu] c-result-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('time')));
    expect(times.every((time) => time !== null && detail.test(time))).toBe(true);
  });
}

test('lava on foot: a cat runs forward with the stick, the right stick turns the camera and the cross jumps', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  await page.evaluate(() => window.__game.startGameForTest('walk', false));
  await expect.poll(async () => (await engineRows(page, 'cats')).length).toBeGreaterThan(0);
  await expect(page.locator('[data-testid=hud] c-hud-card')).toHaveCount(4);
  expect(await page.locator('[data-testid=hud] c-hud-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('place')))).toEqual(['', '', '', '']);
  const before = (await engineRows(page, 'cats'))[0]!;
  await setAxis(page, 1, -1);
  await expect.poll(async () => forwardProgress(before, (await engineRows(page, 'cats'))[0]!), { timeout: 8000 }).toBeGreaterThan(1);
  await setAxis(page, 1, 0);
  await setAxis(page, 2, 1);
  await expect.poll(async () => (await engineRows(page, 'cats'))[0]![6]!, { timeout: 8000 }).toBeGreaterThan(before[6]! + 0.5);
  await setAxis(page, 2, 0);
  await expect
    .poll(
      async () => {
        await tapButton(page, PAD.CROSS);
        return Math.max(...(await Promise.all([0, 1, 2, 3, 4, 5].map(async () => (await engineRows(page, 'cats'))[0]![2]!))));
      },
      { timeout: 8000 },
    )
    .toBeGreaterThan(0);
});

test('fighter jets: the pilot turns with the stick and shoots with the button', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
  await page.evaluate(() => window.__game.startGameForTest('jets', false));
  await expect.poll(async () => (await engineRows(page, 'jets')).length).toBeGreaterThan(0);
  const before = (await engineRows(page, 'jets'))[0]![2]!;
  await setAxis(page, 0, 1);
  await expect.poll(async () => (await engineRows(page, 'jets'))[0]![2]!, { timeout: 8000 }).not.toBe(before);
  await setAxis(page, 0, 0);
  await holdButton(page, PAD.SQUARE, true);
  await expect
    .poll(async () => (await page.evaluate(() => (window.__game.getState().engineState as unknown as { bullets: number[][] }).bullets)).length, {
      timeout: 8000,
    })
    .toBeGreaterThan(0);
  await holdButton(page, PAD.SQUARE, false);
});

test.describe('on a guest phone with its own screen', () => {
  test.setTimeout(120_000);

  for (const id of ['walk', 'jets'] as const) {
    test(`${id}: the guest draws the same game as the host`, async ({ browser }) => {
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
            const [hostLines, guestLines] = await Promise.all([
              host.evaluate(() => window.__game.getState().statusLines),
              guest.evaluate(() => (window.__guest!.getState() as { race: { statusLines: string[] } }).race.statusLines),
            ]);
            return hostLines.length > 0 && hostLines.join('|') === guestLines.join('|');
          },
          { timeout: 30_000, intervals: [500] },
        )
        .toBe(true);
      expect(await guest.evaluate(() => (window.__guest!.getState() as { race: { snapshot: unknown } }).race.snapshot)).not.toBeNull();
      await context.close();
    });
  }
});

test('a guest that stays a plain controller sees how its seat is doing in a game that is not a race, not a lap count', async ({ browser }) => {
  test.setTimeout(120_000);
  const { host, context } = await newHostAndContext(browser, false, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await tapElement(guest, '[data-guest-view]');
  await closeInvitation(host);
  expect(await host.evaluate(() => window.__game.startGameForTest('soccer', false))).toBe(true);
  await expect(guest.locator('[data-join-race]')).toHaveText(/^Team (Rot|Blau)$/, { timeout: 20_000 });
  await context.close();
});

const { defaultBrowserType: _ignored, ...IPHONE } = devices['iPhone 13'];

test.describe('lava on foot on a phone with on-screen controls', () => {
  async function startWalkOnPhone(page: Page): Promise<void> {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
    await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
    await page.locator('#pad-ok').tap();
    await page.evaluate(() => window.__game.startGameForTest('walk', false));
    await expect.poll(async () => (await engineRows(page, 'cats')).length).toBeGreaterThan(0);
  }

  test('the stick moves the cat up and down, not only sideways, and the one action button is called "Springen"', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await context.newPage();
    await startWalkOnPhone(page);
    await expect(page.locator('#btn-drift button')).toHaveText('Springen');
    await expect(page.locator('#btn-brake')).toBeHidden();
    await expect(page.locator('#btn-item button')).toHaveText('Pfotenhieb');
    const box = (await page.locator('#stick-base').boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const client = await context.newCDPSession(page);
    const before = (await engineRows(page, 'cats'))[0]!;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centre.x, y: centre.y, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centre.x, y: centre.y - box.height / 2, id: 1 }] });
    await expect.poll(async () => forwardProgress(before, (await engineRows(page, 'cats'))[0]!), { timeout: 8000 }).toBeGreaterThan(1);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await context.close();
  });

  test('a swipe on the picture turns the camera', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await context.newPage();
    await startWalkOnPhone(page);
    const before = (await engineRows(page, 'cats'))[0]![6]!;
    const client = await context.newCDPSession(page);
    const canvas = (await page.locator('#game-canvas').boundingBox())!;
    const start = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 3 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 60, y: start.y, id: 2 }] });
    await expect.poll(async () => (await engineRows(page, 'cats'))[0]![6]!, { timeout: 8000 }).toBeGreaterThan(before + 0.5);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await context.close();
  });

  test('on the results page the touch cross is gone and the options are tapped directly', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await context.newPage();
    await startWalkOnPhone(page);
    await page.evaluate(() => window.__game.showResultsForTest());
    await expect(page.locator('[data-testid=menu] c-button[data-option-id]')).toHaveCount(3);
    await expect(page.locator('#touch-navigation')).toBeHidden();
    await page.locator('[data-testid=menu] c-button[data-option-id=lobby]').tap();
    await expect(page.locator('[data-testid=lobby]')).toBeVisible();
    await context.close();
  });
});
