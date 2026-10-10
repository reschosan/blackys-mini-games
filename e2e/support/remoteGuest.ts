import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { installFakePeerConnection } from './fakePeerConnection';
import { holdButton, joinWithGamepad, openGame, PAD, phaseOf, tapButton } from './gamepad';

/** Chromium without a real camera: the page may ask for one, a test pattern answers, and the phones find each other on this machine. */
export const FAKE_CAMERA_LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=metal',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--disable-features=WebRtcHideLocalIpsWithMdns',
];

export async function tapElement(page: Page, selector: string): Promise<void> {
  await page.evaluate((query) => document.querySelector(query)!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), selector);
  await page.waitForTimeout(200);
}

/** A finger on a key of the on-screen controls for a moment (the page of a guest has no touch screen in the test). */
export async function pressKey(page: Page, selector: string): Promise<void> {
  await page.evaluate((query) => document.querySelector(query)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })), selector);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 })));
  await page.waitForTimeout(150);
}

/** The host with one gamepad, in the lobby, with the invitation page open. */
export async function openInvitation(page: Page): Promise<void> {
  await openGame(page, 1);
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  await joinWithGamepad(page);
  await tapElement(page, '[data-invite-button]');
  await page.waitForFunction(() => window.__game.getState().invite.status === 'waiting');
}

export async function currentInviteCode(host: Page): Promise<string> {
  return host.evaluate(() => window.__game.getState().invite.qrText!);
}

/** The guest opens the QR code's address and waits for the answer code it would show. Returns that code. */
export async function openGuestPage(context: BrowserContext, inviteCode: string): Promise<{ readonly guest: Page; readonly answerCode: string }> {
  const guest = await context.newPage();
  await guest.goto(inviteCode);
  await guest.waitForSelector('[data-join-answer]');
  const answerCode = await guest.evaluate(() => (document.querySelector('[data-join-answer]') as HTMLElement & { value: string }).value);
  return { guest, answerCode };
}

/** One whole invitation: the guest scans the host's code, the host reads the guest's answer, both sides report connected. */
export async function connectGuest(host: Page, context: BrowserContext): Promise<Page> {
  const before = await host.evaluate(() => window.__game.getState().guests.filter((guest) => guest.connected).length);
  const { guest, answerCode } = await openGuestPage(context, await currentInviteCode(host));
  await host.evaluate((code) => window.__game.submitInviteScan(code), answerCode);
  await guest.waitForFunction(() => (window.__guest?.getState() as { view: string } | undefined)?.view === 'connected', undefined, { timeout: 15000 });
  await host.waitForFunction((count) => window.__game.getState().guests.filter((entry) => entry.connected).length > count, before, { timeout: 15000 });
  return guest;
}

/** Two phones' worth of pages in one browser; `realWebRtc` keeps the browser's own connection instead of the stand-in. */
export async function newHostAndContext(
  browser: Browser,
  realWebRtc = false,
  touch = false,
): Promise<{ readonly host: Page; readonly context: BrowserContext }> {
  // A touch context needs a tall host window: a short side under 768 px would make the host a phone that joins by itself.
  const context = await browser.newContext({ viewport: { width: 1280, height: touch ? 800 : 720 }, permissions: ['camera'], hasTouch: touch });
  if (!realWebRtc) await installFakePeerConnection(context);
  return { host: await context.newPage(), context };
}

/** "Done" goes back to the settings, "Back" there back to the lobby (one level at a time). */
export async function closeInvitation(host: Page): Promise<void> {
  await tapButton(host, PAD.CROSS);
  await host.waitForFunction(() => !document.querySelector('[data-invite-qr]'));
  await tapButton(host, PAD.DOWN);
  await tapButton(host, PAD.CROSS);
  await host.waitForSelector('[data-testid=menu]', { state: 'hidden' });
  await holdButton(host, PAD.CROSS, false);
}

/** Both players ready, both vote for the first map: the lobby becomes a race. The guest taps OK on its cross. */
export async function startRaceWithGuest(host: Page, guest: Page): Promise<void> {
  await tapButton(host, PAD.CROSS);
  await pressKey(guest, '#pad-ok');
  await host.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 8000 });
  await expect
    .poll(
      async () => {
        await tapButton(host, PAD.CROSS);
        await pressKey(guest, '#pad-ok');
        return host.locator('[data-testid=lobby] [data-row-id=kartType]').first().isVisible();
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        await tapButton(host, PAD.CROSS);
        await pressKey(guest, '#pad-ok');
        return host.locator('[data-testid=map-vote]').isVisible();
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        await tapButton(host, PAD.CROSS);
        return host.evaluate(() => document.querySelector('[data-testid=map-vote]')!.textContent!.includes('✓'));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        await pressKey(guest, '#pad-ok');
        return phaseOf(host);
      },
      { timeout: 10_000 },
    )
    .toBe('racing');
}
