import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { GAME_IDS } from './support/gameCount';
import { holdButton, openGame, PAD, playerCount } from './support/gamepad';

/** Captures every screen on every kind of device and verifies the expected phases; appearance still needs visual review (`npm run test:e2e:sweep`, pictures in `SWEEP_DIR`, default `/tmp/sweep`).
 *  See `docs/TESTING.md` for the review workflow. */
test.skip(process.env.SWEEP === undefined, 'run with npm run test:e2e:sweep');
test.setTimeout(180_000);

const DIR = process.env.SWEEP_DIR ?? '/tmp/sweep';
const { defaultBrowserType: _ignored, ...IPHONE } = devices['iPhone 13'];
const { defaultBrowserType: _ignoredToo, ...IPHONE_LANDSCAPE } = devices['iPhone 13 landscape'];
let activePage: Page | undefined;

test.afterEach(async () => {
  if (activePage) await activePage.context().close();
  activePage = undefined;
});

interface Profile {
  readonly name: string;
  readonly context: Parameters<Browser['newContext']>[0];
  /** A touch phone joins by itself and plays with the on-screen controls; the others use a (simulated) gamepad. */
  readonly touch: boolean;
}

const PROFILES: readonly Profile[] = [
  { name: 'desktop720', context: { viewport: { width: 1280, height: 720 } }, touch: false },
  { name: 'desktop1080', context: { viewport: { width: 1920, height: 1080 } }, touch: false },
  { name: 'ipadLandscape', context: { viewport: { width: 1180, height: 820 }, hasTouch: true }, touch: false },
  { name: 'ipadPortrait', context: { viewport: { width: 820, height: 1180 }, hasTouch: true }, touch: false },
  { name: 'phonePortrait', context: { ...IPHONE, deviceScaleFactor: 1 }, touch: true },
  { name: 'phoneLandscape', context: { ...IPHONE_LANDSCAPE, deviceScaleFactor: 1 }, touch: true },
];

async function pressGamepad(page: Page, button: number): Promise<void> {
  await holdButton(page, button, true);
  await page.waitForTimeout(350);
  await holdButton(page, button, false);
  await page.waitForTimeout(300);
}

async function confirm(page: Page, profile: Profile): Promise<void> {
  if (profile.touch) {
    await page.locator('#pad-ok').tap();
    await page.waitForTimeout(500);
  } else await pressGamepad(page, PAD.CROSS);
}

async function shot(page: Page, profile: Profile, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/${profile.name}-${name}.png` });
}

async function open(browser: Browser, profile: Profile): Promise<Page> {
  mkdirSync(DIR, { recursive: true });
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();
  activePage = page;
  if (profile.touch) {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  } else {
    await openGame(page);
    await expect
      .poll(
        async () => {
          if (await playerCount(page)) return true;
          await holdButton(page, PAD.CROSS, true);
          await page.waitForTimeout(350);
          await holdButton(page, PAD.CROSS, false);
          await page.waitForTimeout(300);
          return (await playerCount(page)) > 0;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  }
  await expect.poll(() => playerCount(page), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  return page;
}

for (const profile of PROFILES) {
  test(`${profile.name}: lobby, votes, kart and plane pages`, async ({ browser }) => {
    const page = await open(browser, profile);
    await shot(page, profile, '01-lobby-cat');
    await confirm(page, profile);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    await shot(page, profile, '02-game-vote');
    await confirm(page, profile);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible' });
    await shot(page, profile, '03-kart-page');
    await confirm(page, profile);
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
    await shot(page, profile, '04-map-vote');
  });

  test(`${profile.name}: plane page of the fighter jets`, async ({ browser }) => {
    const page = await open(browser, profile);
    await confirm(page, profile);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    for (let step = 0; step < GAME_IDS.indexOf('jets'); step += 1) await (profile.touch ? page.locator('#pad-right').tap() : pressGamepad(page, PAD.RIGHT));
    await confirm(page, profile);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=planeType]', { state: 'visible' });
    await shot(page, profile, '05-plane-page');
    for (let press = 0; press < 3; press += 1) {
      await (profile.touch ? page.locator('#pad-right').tap() : pressGamepad(page, PAD.RIGHT));
      await shot(page, profile, `05-plane-page-${press + 1}`);
    }
  });

  for (const id of GAME_IDS) {
    test(`${profile.name}: ${id} in play, in the pause and on the result page`, async ({ browser }) => {
      const page = await open(browser, profile);
      await page.waitForFunction(() => typeof window.__game?.startGameForTest === 'function');
      expect(await page.evaluate((game) => window.__game.startGameForTest(game, false), id)).toBe(true);
      await expect.poll(() => page.evaluate(() => window.__game.getState().phase), { timeout: 60_000 }).toBe('racing');
      await page.waitForTimeout(id === 'memory' ? 3000 : 6000);
      await shot(page, profile, `10-game-${id}`);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect.poll(() => page.evaluate(() => window.__game.getState().phase)).toBe('paused');
      await shot(page, profile, `20-pause-${id}`);
      await page.locator('[data-option-id="resume"]').click();
      await expect.poll(() => page.evaluate(() => window.__game.getState().phase)).toBe('racing');
      await page.evaluate(() => window.__game.showResultsForTest());
      await expect.poll(() => page.evaluate(() => window.__game.getState().phase)).toBe('results');
      await shot(page, profile, `21-results-${id}`);
    });
  }
}
