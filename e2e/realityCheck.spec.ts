import { devices, test, type Browser, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { GAME_IDS } from './support/gameCount';
import { holdButton, installFakeGamepads, PAD, setAxis, tapButton } from './support/gamepad';
import { lookAt, note, pick, REALITY_DIR as DIR } from './support/realityReport';

/** Not a test: plays every game through the real lobby on every kind of device, like a person would, with and without AI, and writes
 *  screenshots, layout findings and console errors to `REALITY_DIR` (default `/tmp/reality`). Run with `npm run test:e2e:reality`.
 *  Pick devices and games with `REALITY_PROFILES=desktop720,phonePortrait` and `REALITY_GAMES=jets,memory`. See `docs/TESTING.md`. */
test.skip(process.env.REALITY === undefined, 'run with npm run test:e2e:reality');
test.setTimeout(180_000);

const { defaultBrowserType: _phone, ...IPHONE } = devices['iPhone 13'];
const { defaultBrowserType: _phoneSideways, ...IPHONE_LANDSCAPE } = devices['iPhone 13 landscape'];

type GameId = (typeof GAME_IDS)[number];

interface Profile {
  readonly name: string;
  readonly context: Parameters<Browser['newContext']>[0];
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

/** One way of playing: the same few verbs on a gamepad and on the on-screen controls. */
interface Driver {
  confirm(): Promise<void>;
  right(): Promise<void>;
  down(): Promise<void>;
  pause(): Promise<void>;
  addAi(): Promise<void>;
  /** The stick, right and down positive. */
  stick(x: number, y: number): Promise<void>;
  /** The main action (gas or jump or fire) held or not; touch has auto-gas in the kart. */
  main(held: boolean): Promise<void>;
  /** The second button (item, paw). */
  second(): Promise<void>;
}

function gamepadDriver(page: Page): Driver {
  return {
    confirm: () => tapButton(page, PAD.CROSS),
    right: () => tapButton(page, PAD.RIGHT),
    down: () => tapButton(page, PAD.DOWN),
    pause: () => tapButton(page, PAD.START),
    addAi: () => tapButton(page, PAD.START),
    stick: async (x, y) => {
      await setAxis(page, 0, x);
      await setAxis(page, 1, y);
    },
    main: (held) => holdButton(page, PAD.CROSS, held),
    second: () => tapButton(page, PAD.SQUARE),
  };
}

/** Real touches through the browser (pointer capture and all): finger 1 on the stick, finger 2 for the keys. Chrome's touch events name only
 *  the finger that lands or lifts; the other one stays down. */
function touchDriver(page: Page, client: CDPSession): Driver {
  let stickFinger: { x: number; y: number } | null = null;
  const centre = async (selector: string): Promise<{ x: number; y: number } | null> => {
    const box = await page.locator(selector).first().boundingBox();
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
  };
  const tapKey = async (selector: string): Promise<void> => {
    const at = await centre(selector);
    if (!at || !(await page.locator(selector).first().isVisible())) return;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 2 }] });
    await page.waitForTimeout(140);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...at, id: 2 }] });
    await page.waitForTimeout(140);
  };
  return {
    confirm: () => tapKey('#pad-ok'),
    right: () => tapKey('#pad-right'),
    down: () => tapKey('#pad-down'),
    pause: () => tapKey('#btn-pause'),
    addAi: async () => {
      await page.locator('[data-ai-fill-button]').tap();
      await page.waitForTimeout(200);
    },
    stick: async (x, y) => {
      const base = await page.locator('#stick-base').boundingBox();
      if (!base) return;
      const middle = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
      const radius = base.width / 2;
      if (!stickFinger) {
        stickFinger = middle;
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...stickFinger, id: 1 }] });
      }
      stickFinger = { x: middle.x + x * radius, y: middle.y + y * radius };
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...stickFinger, id: 1 }] });
    },
    main: async (held) => {
      if (held) await tapKey('#btn-drift');
    },
    second: () => tapKey('#btn-item'),
  };
}

interface Run {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly driver: Driver;
  readonly profile: Profile;
  readonly label: string;
  readonly errors: string[];
}

async function look(run: Run, step: string): Promise<void> {
  await lookAt(run.page, `${run.profile.name}/${run.label}-${step}`, run.profile.touch || run.profile.context?.hasTouch === true);
}

async function start(browser: Browser, profile: Profile, label: string): Promise<Run> {
  mkdirSync(`${DIR}/${profile.name}`, { recursive: true });
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  if (!profile.touch) await installFakeGamepads(page, 1);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  const driver = profile.touch ? touchDriver(page, await context.newCDPSession(page)) : gamepadDriver(page);
  if (!profile.touch) await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().playerCount === 1);
  return { page, context, driver, profile, label, errors };
}

const phase = (run: Run): Promise<string> => run.page.evaluate(() => window.__game.getState().phase);

/** The lobby with or without AI cats, ready, the vote for `game`, its card, and its map: until the game runs. */
async function reachGame(run: Run, game: GameId, aiCount: number): Promise<void> {
  const { page, driver } = run;
  for (let ai = 0; ai < aiCount; ai += 1) await driver.addAi();
  await look(run, '01-lobby');
  await driver.confirm();
  for (let wizard = 0; wizard < aiCount * 2 && (await page.locator('[data-ai-wizard-rows]').isVisible()); wizard += 1) {
    await driver.down();
    await driver.confirm();
  }
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 15_000 });
  for (let step = 0; step < GAME_IDS.indexOf(game); step += 1) await driver.right();
  await look(run, '02-game-vote');
  await driver.confirm();
  await page.waitForTimeout(800);
  if (await page.locator('[data-testid=lobby]').isVisible()) {
    await look(run, '03-card');
    await driver.confirm();
  }
  await page.waitForTimeout(800);
  if (await page.locator('[data-testid=map-vote]').isVisible()) {
    await look(run, '04-map-vote');
    await driver.confirm();
  }
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 20_000 });
}

/** Plays a few seconds the way the game asks for it: steering, the action key, the second key. */
async function play(run: Run, game: GameId, seconds: number): Promise<void> {
  const { driver } = run;
  const kart = !['memory', 'walk', 'jets'].includes(game);
  for (let tick = 0; tick < seconds * 4; tick += 1) {
    const turn = Math.sin(tick / 5);
    if (game === 'memory') {
      if (tick % 4 === 0) await driver.right();
      await driver.main(tick % 4 === 2);
    } else {
      await driver.stick(turn, game === 'jets' ? Math.cos(tick / 7) * 0.6 : kart ? 0 : -1);
      await driver.main(kart || tick % 6 === 0);
      if (tick % 10 === 5) await driver.second();
    }
    if (tick === 8) await look(run, '10-play-a');
    if (tick === seconds * 4 - 1) await look(run, '11-play-b');
    await run.page.waitForTimeout(250);
  }
  await driver.stick(0, 0);
  await driver.main(false);
}

for (const profile of pick(PROFILES, process.env.REALITY_PROFILES)) {
  for (const game of pick(GAME_IDS, process.env.REALITY_GAMES)) {
    for (const aiCount of [0, 3]) {
      test(`${profile.name}: ${game} with ${aiCount} AI`, async ({ browser }) => {
        const run = await start(browser, profile, `${game}-ai${aiCount}`);
        try {
          await reachGame(run, game, aiCount);
          const state = await run.page.evaluate(() => window.__game.getState());
          note(`${profile.name} ${run.label}: läuft, ${state.playerCount} Spieler, ${(state.karts as unknown[]).length} Plätze, Spiel ${state.gameId}`);
          await play(run, game, 8);
          await run.driver.pause();
          await run.page.waitForTimeout(500);
          if ((await phase(run)) === 'paused') {
            await look(run, '20-pause');
            if (profile.touch) await run.page.locator('[data-option-id="resume"]').tap();
            else await run.driver.confirm();
          } else note(`${profile.name} ${run.label}: Pause ging nicht auf (Phase ${await phase(run)})`);
          await run.page.evaluate(() => window.__game.showResultsForTest());
          await run.page.waitForTimeout(400);
          await look(run, '30-results');
        } catch (error) {
          await run.page.screenshot({ path: `${DIR}/${profile.name}/${run.label}-FAILED.png` });
          note(`${profile.name} ${run.label}: ABGEBROCHEN ${(error as Error).message.split('\n')[0]}`);
        } finally {
          if (run.errors.length > 0) note(`${profile.name} ${run.label}: Konsolenfehler ${run.errors.slice(0, 5).join(' | ')}`);
          await run.context.close();
        }
      });
    }
  }
}
