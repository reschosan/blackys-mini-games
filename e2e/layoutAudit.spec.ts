import { expect, test, type Page } from '@playwright/test';
import { GAME_IDS } from './support/gameCount';
import { installFakeGamepads } from './support/gamepad';
import { auditSizes, openHost, report } from './support/layoutReport';
import { GAMEPAD_CONTROLS, TOUCH_CONTROLS, tapElement, type Controls } from './support/layoutControls';
import { ALL_SCREENS, TOUCH_SCREENS, type ScreenSize } from './support/screenMatrix';

// Every screen of the game with the gamepad and with the on-screen touch controls, on every screen size, upright and sideways: nothing may cover anything,
// be cut off, be out of reach, be too small to hit or too small or faint to read. Run with `npm run test:e2e:layout`.

test.setTimeout(20 * 60 * 1000);

interface Profile {
  readonly label: string;
  readonly sizes: readonly ScreenSize[];
  readonly controls: Controls;
  readonly touch: boolean;
  readonly layout?: 'overlay' | 'split';
}

const PROFILES: readonly Profile[] = [
  { label: 'Gamepad und Maus', touch: false, sizes: ALL_SCREENS.filter((size) => !size.touch), controls: GAMEPAD_CONTROLS },
  { label: 'Touch, Layout über dem Bild', touch: true, layout: 'overlay', sizes: TOUCH_SCREENS, controls: TOUCH_CONTROLS },
  { label: 'Touch, Geteilter Bildschirm', touch: true, layout: 'split', sizes: TOUCH_SCREENS, controls: TOUCH_CONTROLS },
];

type Audit = (state: string) => Promise<void>;

/** The game screen is audited with a gamepad on the computer sizes and with a finger on the tablet and phone sizes
 *  (touch screens get bigger targets through the pointer media query, so the touch sizes need a touch browser). */
function hostTest(name: string, script: (page: Page, audit: Audit, controls: Controls) => Promise<void>, onlyGamepad = false): void {
  test(name, async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const problems: string[] = [];
    for (const profile of PROFILES.filter((candidate) => !onlyGamepad || !candidate.touch)) {
      const viewport = profile.touch ? { width: 390, height: 844 } : { width: 1280, height: 720 };
      const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), hasTouch: profile.touch, viewport });
      const page = await context.newPage();
      if (!profile.touch) await installFakeGamepads(page, 2);
      if (profile.layout)
        await page.addInitScript((layout) => window.localStorage.setItem('blackys-mini-games:touch', JSON.stringify({ mode: 'auto', layout })), profile.layout);
      try {
        await openHost(page);
        await script(
          page,
          async (state) => {
            problems.push(report(`${state} [${profile.label}]`, await auditSizes(page, profile.sizes)));
          },
          profile.controls,
        );
      } finally {
        await context.close();
      }
    }
    expect(problems.filter(Boolean).join('\n'), 'Befunde').toBe('');
  });
}

// ---------------------------------------------------------------- the game screens

test.describe('game screen', () => {
  hostTest('lobby, empty or with the phone player', async (_page, audit) => {
    await audit('Lobby leer oder mit Handy-Spieler');
  });

  hostTest('lobby, with AI opponents', async (page, audit, controls) => {
    await controls.join(page);
    for (let count = 0; count < 3; count += 1) await controls.aiFill(page);
    await expect(page.locator('[data-ai-fill-button]')).toContainText('3');
    await audit('Lobby mit KI-Gegnern');
  });

  hostTest('AI setup', async (page, audit, controls) => {
    await controls.join(page);
    await controls.aiFill(page);
    await controls.confirm(page);
    await expect(page.locator('[data-ai-wizard-rows]')).toBeVisible();
    await audit('KI-Einrichtung');
  });

  hostTest('game vote', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    await page.waitForTimeout(500);
    await audit('Spielauswahl');
  });

  hostTest('kart page', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible' });
    await page.waitForTimeout(800);
    await audit('Kartseite');
  });

  hostTest('plane page', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    for (let step = 0; step < GAME_IDS.indexOf('jets'); step += 1) await controls.right(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=planeType]', { state: 'visible' });
    await page.waitForTimeout(800);
    await audit('Flugzeugseite');
  });

  hostTest('memory page', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    for (let step = 0; step < GAME_IDS.indexOf('memory'); step += 1) await controls.right(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=memoryLevel]', { state: 'visible' });
    await page.waitForTimeout(800);
    await audit('Memory-Stufe');
  });

  hostTest('map vote', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
    await page.waitForTimeout(1500);
    await audit('Streckenauswahl');
  });

  for (const [name, open] of [
    [
      'settings',
      async (page: Page, controls: Controls) => {
        await controls.settings(page);
      },
    ],
    [
      'sound settings',
      async (page: Page, controls: Controls) => {
        await controls.settings(page);
        await controls.confirm(page);
      },
    ],
    [
      'controls page',
      async (page: Page) => {
        await tapElement(page, '[data-controls-button]');
      },
    ],
    [
      'about page',
      async (page: Page) => {
        await tapElement(page, '[data-about-button]');
      },
    ],
    [
      'credits page',
      async (page: Page, controls: Controls) => {
        await controls.settings(page);
        for (let step = 0; step < 5; step += 1) await controls.down(page);
        await controls.confirm(page);
      },
    ],
    [
      'privacy page',
      async (page: Page, controls: Controls) => {
        await controls.settings(page);
        for (let step = 0; step < 6; step += 1) await controls.down(page);
        await controls.confirm(page);
      },
    ],
  ] as const) {
    hostTest(name, async (page, audit, controls) => {
      await controls.join(page);
      await open(page, controls);
      await page.waitForTimeout(600);
      await audit(name);
    });
  }

  hostTest('race HUD, pause menu', async (page, audit, controls) => {
    await controls.join(page);
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
    await controls.confirm(page);
    await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 60000 });
    await page.waitForFunction(() => window.__game.getState().raceTimeSeconds > 0.5, undefined, { timeout: 60000 });
    await audit('Rennen mit HUD');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => window.__game.getState().phase === 'paused');
    await page.waitForTimeout(600);
    await audit('Pause');
  });

  // The results screen comes from the accelerated test race, which only starts without players; a touch phone has joined by itself.
  // The touch cross over the results is the same as over the pause menu, which is audited above.
  hostTest(
    'results',
    async (page, audit) => {
      await page.evaluate(() => window.__game.startEnduranceRace(2, true));
      await page.waitForFunction(() => window.__game.getState().phase === 'results', undefined, { timeout: 180000 });
      await page.waitForTimeout(800);
      await audit('Ergebnis');
    },
    true,
  );

  hostTest('invitation page', async (page, audit, controls) => {
    await controls.join(page);
    await tapElement(page, '[data-invite-button]');
    await page.waitForFunction(() => window.__game.getState().invite.status === 'waiting');
    await page.waitForTimeout(600);
    await audit('Invite players');
    await page.evaluate(() => window.__game.submitInviteScan('https://example.com/not-ours'));
    await page.waitForSelector('[data-invite-problem]');
    await audit('Invite players with a notice');
  });
});

// ---------------------------------------------------------------- the driving controls on the phone

test.describe('touch driving controls', () => {
  for (const mode of ['auto', 'simple', 'classic'] as const) {
    for (const layout of ['overlay', 'split'] as const) {
      test(`race, ${mode} mode, layout ${layout}`, async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL;
        const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), hasTouch: true, viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        await page.addInitScript((saved) => window.localStorage.setItem('blackys-mini-games:touch', JSON.stringify(saved)), { mode, layout });
        try {
          await openHost(page);
          await TOUCH_CONTROLS.confirm(page);
          await page.waitForSelector('[data-testid=game-vote]', { state: 'visible' });
          await TOUCH_CONTROLS.confirm(page);
          await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible' });
          await TOUCH_CONTROLS.confirm(page);
          await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
          await TOUCH_CONTROLS.confirm(page);
          await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 60000 });
          await page.locator('#stick-zone').waitFor({ state: 'visible' });
          const problems = report(`Handy: Rennen (${mode}, ${layout})`, await auditSizes(page, TOUCH_SCREENS));
          expect(problems, 'Befunde').toBe('');
        } finally {
          await context.close();
        }
      });
    }
  }
});
