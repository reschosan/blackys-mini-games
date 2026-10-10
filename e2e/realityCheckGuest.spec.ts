import { expect, test, type Page } from '@playwright/test';
import { GAME_IDS } from './support/gameCount';
import { holdButton, PAD, phaseOf, tapButton } from './support/gamepad';
import { lookAt, note, pick } from './support/realityReport';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation, pressKey, tapElement } from './support/remoteGuest';

/** Not a test: the reality check of the guest phones (see `realityCheck.spec.ts`). The host plays with a gamepad, a guest phone joins by
 *  the invitation and plays every game with its own screen and as a plain controller, upright and sideways. Run with `npm run test:e2e:reality`. */
test.skip(process.env.REALITY === undefined, 'run with npm run test:e2e:reality');
test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });
test.setTimeout(180_000);

type GameId = (typeof GAME_IDS)[number];

interface GuestProfile {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly ownScreen: boolean;
}

const GUEST_PROFILES: readonly GuestProfile[] = [
  { name: 'guestLandscape', viewport: { width: 844, height: 390 }, ownScreen: true },
  { name: 'guestPortrait', viewport: { width: 390, height: 844 }, ownScreen: true },
  { name: 'guestController', viewport: { width: 390, height: 844 }, ownScreen: false },
];

interface GuestRun {
  readonly host: Page;
  readonly guest: Page;
  readonly label: string;
}

const look = (run: GuestRun, step: string): Promise<void> => lookAt(run.guest, `${run.label}-${step}`, true);
const lookHost = (run: GuestRun, step: string): Promise<void> => lookAt(run.host, `${run.label}-host-${step}`, false);

/** Host and guest move to the same card and both press OK until the screen changes. */
async function bothChoose(run: GuestRun, steps: number, until: () => Promise<boolean>): Promise<void> {
  for (let step = 0; step < steps; step += 1) {
    await tapButton(run.host, PAD.RIGHT);
    await pressKey(run.guest, '#pad-right');
  }
  await expect
    .poll(
      async () => {
        await tapButton(run.host, PAD.CROSS);
        await pressKey(run.guest, '#pad-ok');
        return until();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function reachGame(run: GuestRun, game: GameId): Promise<void> {
  const { host } = run;
  await look(run, '01-lobby');
  await bothChoose(run, 0, () => host.locator('[data-testid=game-vote]').isVisible());
  await look(run, '02-game-vote');
  await bothChoose(
    run,
    GAME_IDS.indexOf(game),
    async () =>
      (await host.locator('[data-testid=map-vote]').isVisible()) ||
      (await host.locator('[data-testid=lobby]').isVisible()) ||
      (await phaseOf(host)) === 'racing',
  );
  if (await host.locator('[data-testid=lobby]').isVisible()) {
    await look(run, '03-card');
    await bothChoose(run, 0, async () => (await host.locator('[data-testid=map-vote]').isVisible()) || (await phaseOf(host)) === 'racing');
  }
  if (await host.locator('[data-testid=map-vote]').isVisible()) {
    await look(run, '04-map-vote');
    await bothChoose(run, 0, async () => (await phaseOf(host)) === 'racing');
  }
}

async function play(run: GuestRun, game: GameId): Promise<void> {
  for (let tick = 0; tick < 16; tick += 1) {
    await pressKey(run.guest, game === 'memory' && tick % 2 === 0 ? '#pad-right' : '#btn-drift');
    if (tick === 4) await look(run, '10-play-a');
    if (tick === 4) await lookHost(run, '10-play-a');
  }
  await look(run, '11-play-b');
}

for (const profile of pick(GUEST_PROFILES, process.env.REALITY_PROFILES)) {
  for (const game of pick(GAME_IDS, process.env.REALITY_GAMES)) {
    test(`${profile.name}: ${game} with a guest phone`, async ({ browser }) => {
      const { host, context } = await newHostAndContext(browser, false, true);
      const errors: string[] = [];
      const run = { host, guest: host, label: `${profile.name}/${game}` };
      try {
        await openInvitation(host);
        const guest = await connectGuest(host, context);
        guest.on('pageerror', (error) => errors.push(error.message));
        Object.assign(run, { guest });
        await guest.setViewportSize(profile.viewport);
        if (!profile.ownScreen) await tapElement(guest, '[data-guest-view]');
        await closeInvitation(host);
        await reachGame(run, game);
        note(`${run.label}: läuft, Gast ${profile.ownScreen ? 'mit eigenem Bildschirm' : 'als Controller'}`);
        await play(run, game);
        await pressKey(guest, '#btn-pause');
        await host.waitForTimeout(600);
        if ((await phaseOf(host)) === 'paused') {
          await look(run, '20-pause');
          await holdButton(host, PAD.CROSS, false);
          await tapButton(host, PAD.CROSS);
        } else note(`${run.label}: Pause vom Gast ging nicht auf (Phase ${await phaseOf(host)})`);
        await host.evaluate(() => window.__game.showResultsForTest());
        await look(run, '30-results');
      } catch (error) {
        note(`${run.label}: ABGEBROCHEN ${(error as Error).message.split('\n')[0]}`);
        await lookAt(run.guest, `${run.label}-FAILED`, true);
        await lookAt(host, `${run.label}-host-FAILED`, false);
      } finally {
        if (errors.length > 0) note(`${run.label}: Konsolenfehler ${errors.slice(0, 5).join(' | ')}`);
        await context.close();
      }
    });
  }
}
