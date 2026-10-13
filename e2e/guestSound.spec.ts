import { expect, test, type Page } from '@playwright/test';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation, startRaceWithGuest } from './support/remoteGuest';

// A guest phone has its own sound with its own setting: switched on there, it plays there, from the lobby on and through every game.
// Browsers start sound only inside a user gesture, and a finger going down is none; the taps here are real touches.

test.use({ launchOptions: { args: [...FAKE_CAMERA_LAUNCH_ARGS, '--autoplay-policy=user-gesture-required'] } });
test.setTimeout(120_000);

interface AudioWindow {
  __audioStates: () => string[];
}

const audioStates = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as AudioWindow).__audioStates());

test('the guest switches its sound on in the lobby, it starts at once and the race keeps the same sound', async ({ browser }) => {
  const { host, context } = await newHostAndContext(browser, false, true);
  await context.addInitScript(() => {
    const contexts: AudioContext[] = [];
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
    };
    (window as unknown as AudioWindow).__audioStates = () => contexts.map((audio) => audio.state);
  });
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await guest.setViewportSize({ width: 844, height: 390 });
  await closeInvitation(host);
  const soundButton = guest.locator('[data-guest-sound]').first();
  await expect(soundButton).toBeVisible({ timeout: 20_000 });
  const label = await soundButton.getAttribute('label');

  await soundButton.tap();
  await expect.poll(() => soundButton.getAttribute('label')).not.toBe(label);
  await expect.poll(() => audioStates(guest)).toEqual(['running']);

  await startRaceWithGuest(host, guest);
  await guest.waitForFunction(() => (window.__guest?.getState() as { raceShown: boolean }).raceShown, undefined, { timeout: 30_000 });
  expect(await audioStates(guest)).toEqual(['running']);
  await context.close();
});
