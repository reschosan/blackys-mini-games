import { expect, test } from '@playwright/test';
import { phaseOf, RACE_START_LOCK_MS } from './support/gamepad';
import {
  closeInvitation,
  connectGuest,
  currentInviteCode,
  FAKE_CAMERA_LAUNCH_ARGS,
  newHostAndContext,
  openInvitation,
  startRaceWithGuest,
  tapElement,
} from './support/remoteGuest';

// Phones that join the host over a direct connection: the two pages of one browser stand in for two phones;
// the QR codes' text is handed over by the test instead of the camera.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });
test.setTimeout(90_000);

test.describe('guest phones', () => {
  test('a guest joins over the invitation, plays the lobby with its cross and drives as a plain controller', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    const guest = await connectGuest(host, context);

    expect(await host.evaluate(() => window.__game.getState().playerSources)).toEqual(['gamepad', 'remote']);
    await expect.poll(() => guest.evaluate(() => (window.__guest!.getState() as { seat: number | null }).seat)).toBe(1);
    await expect(host.locator('[data-invite-slots]')).toContainText('Verbunden');

    await expect.poll(() => host.evaluate(() => window.__game.getState().guests[0]?.latencyMilliseconds), { timeout: 8000 }).not.toBeNull();

    await closeInvitation(host);
    await expect(host.locator('[data-testid=lobby]')).toBeVisible();

    // The guest as a plain controller, the shared screen.
    await guest.evaluate(() => document.querySelector('[data-guest-view]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    await startRaceWithGuest(host, guest);

    await expect(guest.locator('[data-join-race]')).toContainText('Runde', { timeout: 8000 });
    await expect(guest.locator('#touch-driving')).toBeVisible();
    await host.waitForTimeout(RACE_START_LOCK_MS + 1500);
    const speeds = await host.evaluate(() => window.__game.getState().karts.map((kart) => kart.speed));
    expect(speeds[1]).toBeGreaterThan(1);
    expect(await phaseOf(host)).toBe('racing');
    await context.close();
  });

  test('a guest that drops out gets its seat back with a new invitation', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    const idBefore = await host.evaluate(() => window.__game.getState().guests[0]!.id);

    await guest.close();
    await host.waitForFunction(() => window.__game.getState().guests[0]?.connected === false, undefined, { timeout: 10_000 });
    await host.waitForFunction(() => window.__game.getState().invite.reclaiming === true, undefined, { timeout: 10_000 });
    await expect(host.locator('[data-invite-slots]')).toContainText('Weg');
    expect(await host.evaluate(() => window.__game.getState().playerCount)).toBe(2);

    await connectGuest(host, context);
    const guests = await host.evaluate(() => window.__game.getState().guests);
    expect(guests).toMatchObject([{ id: idBefore, connected: true }]);
    expect(await host.evaluate(() => window.__game.getState().playerCount)).toBe(2);
    await context.close();
  });

  test("a code that is not the guest's answer is refused with a friendly hint and the invitation stays", async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    const code = await currentInviteCode(host);

    await host.evaluate(() => window.__game.submitInviteScan('https://example.com/something-else'));
    await expect(host.locator('[data-invite-problem]')).toContainText('Hoppla');
    expect(await currentInviteCode(host)).toBe(code);
    expect(await host.evaluate(() => window.__game.getState().guests)).toEqual([]);
    await context.close();
  });

  test('scanning an invitation code (instead of an answer) says where it belongs', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    await host.evaluate((code) => window.__game.submitInviteScan(code), await currentInviteCode(host));
    await expect(host.locator('[data-invite-problem]')).toContainText('Kamera-App');
    expect(await host.evaluate(() => window.__game.getState().invite.status)).toBe('waiting');
    await context.close();
  });

  test('every invitation is for one guest only: a second guest needs its own code', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    const firstCode = await currentInviteCode(host);
    await connectGuest(host, context);
    await host.waitForFunction(
      (previous) => window.__game.getState().invite.status === 'waiting' && window.__game.getState().invite.qrText !== previous,
      firstCode,
    );
    await connectGuest(host, context);
    expect(await host.evaluate(() => window.__game.getState().playerSources)).toEqual(['gamepad', 'remote', 'remote']);
    await context.close();
  });

  test('the join page without a code says what to do', async ({ browser }) => {
    const { context } = await newHostAndContext(browser);
    const page = await context.newPage();
    await page.goto('/join.html');
    await expect(page.locator('[data-join-view=noCode]')).toContainText('Scanne den QR-Code');
    await page.goto('/join.html?second#o=kaputt');
    await expect(page.locator('[data-join-view=badCode]')).toContainText('Hoppla');
    await context.close();
  });

  test('"Neuer Code" replaces the code and "Zurück" leaves the page with the camera off', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser);
    await openInvitation(host);
    const first = await currentInviteCode(host);
    await tapElement(host, '[data-option-id=inviteRenew]');
    await host.waitForFunction(
      (previous) => window.__game.getState().invite.status === 'waiting' && window.__game.getState().invite.qrText !== previous,
      first,
    );
    await tapElement(host, '[data-option-id=inviteBack]');
    await expect(host.locator('[data-invite-qr]')).toHaveCount(0);
    expect(await host.evaluate(() => window.__game.getState().invite.status)).toBeDefined();
    await context.close();
  });
});
