import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { phaseOf, RACE_START_LOCK_MS } from './support/gamepad';
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

// The two pages of one browser stand in for two phones (stand-in connection, see `fakePeerConnection.ts`).

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });
test.setTimeout(150_000);

const PHONE_LANDSCAPE = { width: 844, height: 390 };

interface GuestRaceState {
  ready: boolean;
  phase: string;
  seat: number;
  snapshots: { received: number; dropped: number };
  predicting: boolean;
  prediction: { reconciliations: number; snaps: number; worstErrorMeters: number; lastErrorMeters: number; ticks: number };
  karts: { x: number; z: number; yaw: number; speed: number }[];
  ownShown: { x: number; z: number; yaw: number } | null;
  camera: { position: number[] } | null;
  results: unknown;
  graphicsQuality: string;
  emergencyGraphics: boolean;
}

interface GuestState {
  view: string;
  viewMode: string;
  raceShown: boolean;
  notice: string | null;
  phase: string | null;
  seat: number | null;
  race: GuestRaceState | null;
}

const guestState = (guest: Page): Promise<GuestState> => guest.evaluate(() => window.__guest!.getState() as GuestState);
const raceOf = async (guest: Page): Promise<GuestRaceState> => (await guestState(guest)).race!;
const hostKarts = (host: Page) => host.evaluate(() => window.__game.getState().karts);

async function setUpGuestRace(browser: import('@playwright/test').Browser) {
  const { host, context } = await newHostAndContext(browser, false, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await guest.setViewportSize(PHONE_LANDSCAPE);
  await closeInvitation(host);
  return { host, guest, context };
}

async function finger(client: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number): Promise<void> {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('the race on the guest phone', () => {
  test('the guest draws the race itself with its own camera, and the host held the start until it was ready', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });

    await expect(guest.locator('#game-canvas')).toBeVisible();
    await expect(guest.locator('[data-testid=hud]')).toBeVisible();
    await expect(guest.locator('[data-testid=lobby], [data-join-view]')).toHaveCount(0);

    await host.waitForTimeout(RACE_START_LOCK_MS + 3000);
    const race = await raceOf(guest);
    expect(race.snapshots.received).toBeGreaterThan(40);
    expect(race.seat).toBe(1);
    expect(race.predicting).toBe(true);

    const own = (await hostKarts(host))[1]!;
    expect(own.speed).toBeGreaterThan(5);
    const shown = race.ownShown!;
    expect(Math.hypot(shown.x - own.x, shown.z - own.z)).toBeLessThan(6);

    const camera = race.camera!.position;
    expect(Math.hypot(camera[0]! - shown.x, camera[2]! - shown.z)).toBeLessThan(40);
    const other = (await hostKarts(host))[0]!;
    expect(Math.hypot(camera[0]! - other.x, camera[2]! - other.z)).toBeGreaterThan(Math.hypot(camera[0]! - shown.x, camera[2]! - shown.z));
    expect(await phaseOf(host)).toBe('racing');
    await context.close();
  });

  test('steering answers at once on the guest, before the host could have sent a picture back', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 2500);

    const touch = await context.newCDPSession(guest);
    const stick = await centerOf(guest, '#stick-base');
    const before = (await raceOf(guest)).ownShown!.yaw;
    await finger(touch, 'touchStart', stick.x, stick.y);
    await finger(touch, 'touchMove', stick.x + 60, stick.y);
    const turnedAfter = await guest.evaluate(async (yawBefore) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < 1500) {
        const yaw = (window.__guest!.getState() as { race: { ownShown: { yaw: number } } }).race.ownShown.yaw;
        if (Math.abs(yaw - yawBefore) > 0.02) return performance.now() - startedAt;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return null;
    }, before);
    await finger(touch, 'touchEnd', stick.x + 60, stick.y);
    expect(turnedAfter).not.toBeNull();
    expect(turnedAfter!).toBeLessThan(250);
    await context.close();
  });

  test('a guest that chose "Nur Controller" does not hold the start and draws nothing', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await guest.evaluate(() => document.querySelector('[data-guest-view]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    await expect(guest.locator('[data-guest-view]:visible')).toContainText('Nur Controller');
    await startRaceWithGuest(host, guest);
    await host.waitForTimeout(1500);
    const state = await guestState(guest);
    expect(state.raceShown).toBe(false);
    expect(state.race).toBeNull();
    await expect(guest.locator('#game-canvas')).toBeHidden();
    await expect(guest.locator('[data-join-race]')).toContainText('Runde', { timeout: 15_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1500);
    expect((await hostKarts(host))[1]!.speed).toBeGreaterThan(1);
    await context.close();
  });

  test('a controller guest switches to its own screen in the middle of the race and gets the picture', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await tapElement(guest, '[data-guest-view]');
    await startRaceWithGuest(host, guest);
    await host.waitForTimeout(RACE_START_LOCK_MS + 1500);
    expect((await guestState(guest)).raceShown).toBe(false);

    await tapElement(guest, '[data-guest-view]');
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await expect(guest.locator('#game-canvas')).toBeVisible();
    await expect.poll(async () => (await raceOf(guest)).snapshots.received, { timeout: 10_000 }).toBeGreaterThan(20);
    expect(await phaseOf(host)).toBe('racing');
    await context.close();
  });

  test('a guest with its own screen switches to controller from its pause panel, and the race goes on without the picture', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);
    await pressKey(guest, '#btn-pause');
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');

    await tapElement(guest, '[data-guest-view]');
    await expect.poll(async () => (await guestState(guest)).raceShown).toBe(false);
    expect((await guestState(guest)).viewMode).toBe('controller');
    await expect(guest.locator('#game-canvas')).toBeHidden();
    await context.close();
  });

  test('the result and the way back to the lobby arrive on the guest too', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);
    await host.evaluate(() => window.dispatchEvent(new Event('blur')));
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');
    await expect.poll(async () => (await guestState(guest)).phase).toBe('paused');
    await expect(guest.locator('[data-guest-pause]')).toBeVisible();
    await expect(guest.locator('#touch-navigation')).toBeHidden();
    await host.locator('[data-option-id="lobby"]').click();
    await expect.poll(async () => (await guestState(guest)).phase, { timeout: 10_000 }).toBe('lobby');
    await expect(guest.locator('[data-testid=guest-lobby]')).toBeVisible({ timeout: 20_000 });
    await expect(guest.locator('#game-canvas')).toBeHidden();
    await context.close();
  });

  test('when the host goes away the guest says so', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await host.close();
    await expect.poll(async () => (await guestState(guest)).view, { timeout: 20_000 }).toBe('ended');
    await expect(guest.locator('[data-join-view=ended]')).toContainText('Hoppla');
    await context.close();
  });

  test('a guest that dropped out in a race gets back in from the pause menu and drives on', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1500);
    await guest.close();
    await host.waitForFunction(() => window.__game.getState().guests[0]?.connected === false, undefined, { timeout: 10_000 });
    await host.evaluate(() => window.dispatchEvent(new Event('blur')));
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');
    await host.locator('[data-option-id="settings"]').click();
    await host.locator('[data-option-id="invite"]').click();
    await host.waitForFunction(() => window.__game.getState().invite.status === 'waiting' && window.__game.getState().invite.reclaiming === true);

    const back = await connectGuest(host, context);
    await back.setViewportSize(PHONE_LANDSCAPE);
    await back.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    expect(await host.evaluate(() => window.__game.getState().guests)).toMatchObject([{ connected: true }]);
    await context.close();
  });

  test('a phone that cannot keep up draws less: first "Niedrig", then bare bones', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    const slowDown = await context.newCDPSession(guest);
    await slowDown.send('Emulation.setCPUThrottlingRate', { rate: 70 });
    await expect.poll(async () => (await raceOf(guest)).emergencyGraphics, { timeout: 130_000, intervals: [1000] }).toBe(true);
    const race = await raceOf(guest);
    expect(race.graphicsQuality).toBe('low');
    await context.close();
  });

  test('a guest pauses with its own key, everybody sees who it was, and "Resume" resumes', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);

    await pressKey(guest, '#btn-pause');
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');
    await expect(guest.locator('[data-guest-pause]')).toContainText('hat pausiert');
    await expect(host.locator('[data-testid=menu]')).toContainText('hat pausiert');

    await tapElement(guest, '[data-pause-option=resume]');
    await host.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 10_000 });
    await expect(guest.locator('[data-guest-pause]')).toHaveCount(0);
    await context.close();
  });

  test('what a guest presses in its own pause panel moves that panel, and not the menu of the host', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);
    await pressKey(guest, '#btn-pause');
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');

    const hostSelection = (): Promise<string | null> => host.locator('[data-testid=menu] c-button[active]').getAttribute('data-option-id');
    const before = await hostSelection();
    await pressKey(guest, '#pad-down');
    await expect(guest.locator('[data-pause-option=leave][active]')).toHaveCount(1);
    expect(await hostSelection()).toBe(before);
    await context.close();
  });

  test('"Leave game" asks once more, then the guest is out and the host sees it', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await startRaceWithGuest(host, guest);
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60_000 });
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);
    await pressKey(guest, '#btn-pause');
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');

    await tapElement(guest, '[data-pause-option=leave]');
    await expect(guest.locator('[data-pause-option=leave]')).toHaveAttribute('label', 'Wirklich verlassen?');
    await tapElement(guest, '[data-pause-option=leave]');
    await expect(guest.locator('[data-join-view=left]')).toContainText('verlassen');
    await host.waitForFunction(() => window.__game.getState().guests[0]?.connected === false, undefined, { timeout: 10_000 });
    await context.close();
  });

  test('a guest that is only a controller gets no panel of its own: the menu is on the big screen and is steered from here', async ({ browser }) => {
    const { host, guest, context } = await setUpGuestRace(browser);
    await guest.evaluate(() => document.querySelector('[data-guest-view]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    await startRaceWithGuest(host, guest);
    await host.waitForTimeout(RACE_START_LOCK_MS + 1000);
    await pressKey(guest, '#btn-pause');
    await host.waitForFunction(() => window.__game.getState().phase === 'paused');
    await expect(guest.locator('[data-guest-pause]')).toHaveCount(0);
    await expect(guest.locator('[data-join-view=connected]')).toContainText('großen Bildschirm');
    const selection = (): Promise<string | null> => host.locator('[data-testid=menu] c-button[active]').getAttribute('data-option-id');
    const before = await selection();
    await pressKey(guest, '#pad-down');
    await expect.poll(selection).not.toBe(before);
    await context.close();
  });
});
