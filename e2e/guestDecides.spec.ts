import { expect, test, type Page } from '@playwright/test';
import { phaseOf } from './support/gamepad';
import {
  closeInvitation,
  connectGuest,
  FAKE_CAMERA_LAUNCH_ARGS,
  newHostAndContext,
  openInvitation,
  pressKey,
  startRaceWithGuest,
  tapElement,
} from './support/remoteGuest';

// A host that plays nobody itself (a laptop with only phones joined) has no one to press "Nochmal" or the lobby after the race: the first
// guest does it. With a player of its own the host stays the one who chooses.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });
test.setTimeout(120_000);

const RESULT_BUTTONS = '[data-result-option]';

async function connectToHostWithoutPlayer(page: Page, context: Parameters<typeof connectGuest>[1]): Promise<Page> {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  await tapElement(page, '[data-invite-button]');
  await page.waitForFunction(() => window.__game.getState().invite.status === 'waiting');
  const guest = await connectGuest(page, context);
  await tapElement(page, '[data-option-id=inviteBack]');
  await tapElement(page, '[data-option-id=settingsBack]');
  await page.waitForSelector('[data-testid=menu]', { state: 'hidden' });
  return guest;
}

async function endRaceAndShowResults(host: Page): Promise<void> {
  await host.waitForTimeout(1500);
  await host.evaluate(() => window.__game.showResultsForTest());
  await expect.poll(() => phaseOf(host)).toBe('results');
}

test('with a host that plays nobody, the guest on its own screen chooses the lobby after the race', async ({ browser }) => {
  const { host, context } = await newHostAndContext(browser, false, false);
  const guest = await connectToHostWithoutPlayer(host, context);
  await pressKey(guest, '#pad-ok');
  await host.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 8000 });
  await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
  await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
  await guest.waitForSelector('[data-testid=guest-lobby] [data-row-id=kartType]', { state: 'visible', timeout: 8000 });
  await tapElement(guest, '[data-testid=guest-lobby] [data-row-id="ready"]');
  await host.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 8000 });
  await tapElement(guest, '[data-testid=guest-lobby] [data-map-index="0"]');
  await tapElement(guest, '[data-testid=guest-lobby] [data-map-index="0"]');
  await expect.poll(() => phaseOf(host), { timeout: 15_000 }).toBe('racing');
  await endRaceAndShowResults(host);
  await expect(guest.locator(RESULT_BUTTONS)).toHaveCount(3, { timeout: 15_000 });
  await tapElement(guest, '[data-result-option=lobby]');
  await expect.poll(() => phaseOf(host), { timeout: 10_000 }).toBe('lobby');
  await expect(guest.locator('[data-testid=guest-lobby]')).toBeVisible({ timeout: 20_000 });
  await context.close();
});

test('with a host that plays itself, the guest sees the result but only the host chooses', async ({ browser }) => {
  const { host, context } = await newHostAndContext(browser, false, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await closeInvitation(host);
  await startRaceWithGuest(host, guest);
  await endRaceAndShowResults(host);
  await expect(guest.locator('[data-testid=client-results]')).toContainText('Gastgeber');
  await expect(guest.locator(RESULT_BUTTONS)).toHaveCount(0);
  await context.close();
});
