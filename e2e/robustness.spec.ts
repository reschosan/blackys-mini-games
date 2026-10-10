import { expect, test, type Page } from '@playwright/test';

const BUTTON_ACCELERATE = 0;
const BUTTON_STEER_RIGHT = 15;
const BUTTON_DPAD_DOWN = 13;
const RACE_START_LOCK_MS = 3600;

async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
}

async function installFakeGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = { connected: true, buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
    (window as unknown as { fakePad: typeof pad }).fakePad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad.connected ? pad : null], configurable: true });
  });
}

async function setPadConnected(page: Page, connected: boolean): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { fakePad: { connected: boolean } }).fakePad.connected = value;
  }, connected);
}

async function holdPadButton(page: Page, button: number, pressed: boolean): Promise<void> {
  await page.evaluate(
    ([index, value]) => {
      (window as unknown as { fakePad: { buttons: { pressed: boolean }[] } }).fakePad.buttons[index as number]!.pressed = value as boolean;
    },
    [button, pressed],
  );
}

async function tapPadButton(page: Page, button: number): Promise<void> {
  await holdPadButton(page, button, true);
  await page.waitForTimeout(120);
  await holdPadButton(page, button, false);
  await page.waitForTimeout(120);
}

async function activeRowId(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('c-cat-preview-card [data-row-id][active]')?.getAttribute('data-row-id') ?? null);
}

async function startRaceWithGamepad(page: Page): Promise<void> {
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForFunction(() => window.__game.getState().playerCount === 1);
  for (let attempt = 0; attempt < 8 && (await activeRowId(page)) !== 'ready'; attempt += 1) await tapPadButton(page, BUTTON_DPAD_DOWN);
  await tapPadButton(page, BUTTON_STEER_RIGHT);
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
  await page.waitForTimeout(RACE_START_LOCK_MS);
}

async function kartSpeed(page: Page): Promise<number> {
  return page.evaluate(() => window.__game.getState().karts[0]?.speed ?? 0);
}

test('a gamepad unplugged mid-race shows a warning and lets the kart roll out, and plugging it back in gives control again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installFakeGamepad(page);
  await openGame(page);
  await startRaceWithGamepad(page);

  await holdPadButton(page, BUTTON_ACCELERATE, true);
  await expect.poll(() => kartSpeed(page), { timeout: 5000 }).toBeGreaterThan(3);

  await setPadConnected(page, false);
  await expect(page.locator('c-alert-banner')).toContainText('getrennt');
  await expect.poll(() => kartSpeed(page), { timeout: 8000 }).toBeLessThan(0.5);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);

  await setPadConnected(page, true);
  await expect(page.locator('c-alert-banner')).toHaveCount(0);
  await expect.poll(() => kartSpeed(page), { timeout: 5000 }).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('a gamepad unplugged in the lobby keeps its slot and works again when plugged back in', async ({ page }) => {
  await installFakeGamepad(page);
  await openGame(page);
  await tapPadButton(page, BUTTON_ACCELERATE);
  await page.waitForFunction(() => window.__game.getState().playerCount === 1);

  await setPadConnected(page, false);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);

  await setPadConnected(page, true);
  await tapPadButton(page, BUTTON_DPAD_DOWN);
  expect(await activeRowId(page)).not.toBe(null);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);
});

test('a tab sent to the background pauses a running race', async ({ page }) => {
  await installFakeGamepad(page);
  await openGame(page);
  await startRaceWithGamepad(page);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__game.getState().phase === 'paused');
});

test('resizing the window and turning it upright during a race keeps the picture and the race intact', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installFakeGamepad(page);
  await openGame(page);
  await startRaceWithGamepad(page);
  await holdPadButton(page, BUTTON_ACCELERATE, true);

  for (const size of [
    { width: 800, height: 600 },
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    const canvas = await page.evaluate(() => {
      const element = document.querySelector('canvas') as HTMLCanvasElement;
      return { clientWidth: element.clientWidth, clientHeight: element.clientHeight, width: element.width, height: element.height };
    });
    expect(canvas.clientWidth).toBe(size.width);
    expect(canvas.clientHeight).toBe(size.height);
    expect(canvas.width).toBeGreaterThanOrEqual(size.width);
    expect(await page.evaluate(() => window.__game.getState().phase)).toBe('racing');
    await expect(page.locator('c-hud-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
