import { devices, expect, test, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { RACE_START_LOCK_MS } from './support/gamepad';

const { defaultBrowserType: _ignored, ...IPHONE } = devices['iPhone 13'];
const IPAD = { viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true };

async function openPhone(context: BrowserContext, settings?: { mode: string; layout: string }): Promise<Page> {
  const page = await context.newPage();
  if (settings) await page.addInitScript((saved) => window.localStorage.setItem('catkart:touch', JSON.stringify(saved)), settings);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
  return page;
}

async function tapKey(page: Page, selector: string): Promise<void> {
  await page.waitForTimeout(200);
  await page.locator(selector).tap();
  await page.waitForTimeout(150);
}

async function startRace(page: Page): Promise<void> {
  await tapKey(page, '#pad-ok');
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapKey(page, '#pad-ok');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await tapKey(page, '#pad-ok');
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await tapKey(page, '#pad-ok');
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 10000 });
  await page.waitForTimeout(RACE_START_LOCK_MS);
}

/** A real finger: touch events go through the browser's own pointer handling, including pointer capture. */
async function finger(client: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number): Promise<void> {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const dockOf = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('#app')!.dataset.touchDock);

test.describe('phone with on-screen controls', () => {
  test('joins by itself, shows only its cat and one free slot, and no QR code or room code', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context);
    expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);
    await expect(page.locator('[data-slot=player]')).toHaveCount(1);
    await expect(page.locator('[data-slot=empty]')).toHaveCount(1);
    await expect(page.locator('[data-room-code], c-invite-card, img[alt*=QR]')).toHaveCount(0);
    await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('#touch-navigation')).toBeVisible();
    await expect(page.locator('#touch-driving')).toBeHidden();
    await context.close();
  });

  test('the cross moves through the lobby: down changes the row, right changes the value, OK sets ready', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context);
    const activeRow = page.locator('[data-slot=player] [data-row-id][active]');
    await expect(activeRow).toHaveAttribute('data-row-id', 'preset');

    const before = await activeRow.getAttribute('value');
    await tapKey(page, '#pad-right');
    expect(await activeRow.getAttribute('value')).not.toBe(before);
    await tapKey(page, '#pad-down');
    await expect(activeRow).toHaveAttribute('data-row-id', 'ready');

    await tapKey(page, '#pad-ok');
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
    await context.close();
  });

  test('a whole race: ready, vote, drive with auto-gas and steer with the stick, pause and go back to the lobby', async ({ browser }) => {
    const errors: string[] = [];
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context);
    page.on('pageerror', (error) => errors.push(error.message));
    await startRace(page);
    await expect(page.locator('#touch-driving')).toBeVisible();
    await expect(page.locator('#touch-navigation')).toBeHidden();

    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__game.getState().karts[0]!.speed)).toBeGreaterThan(1);

    const stick = await centerOf(page, '#stick-base');
    const yawBefore = await page.evaluate(() => window.__game.getState().karts[0]!.yaw);
    const touch = await context.newCDPSession(page);
    await finger(touch, 'touchStart', stick.x, stick.y);
    await finger(touch, 'touchMove', stick.x + 60, stick.y);
    await page.waitForTimeout(800);
    await finger(touch, 'touchEnd', stick.x + 60, stick.y);
    const yawAfter = await page.evaluate(() => window.__game.getState().karts[0]!.yaw);
    expect(Math.abs(yawAfter - yawBefore)).toBeGreaterThan(0.1);

    await tapKey(page, '#btn-pause');
    await expect.poll(() => page.evaluate(() => window.__game.getState().phase)).toBe('paused');
    await expect(page.locator('#touch-navigation')).toBeHidden();
    await page.locator('[data-testid=menu] c-button[data-option-id=resume]').tap();
    await expect.poll(() => page.evaluate(() => window.__game.getState().phase)).toBe('racing');
    expect(errors).toEqual([]);
    await context.close();
  });

  test('simple mode: stick up drives, up-left and up-right steer to opposite sides', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context, { mode: 'simple', layout: 'overlay' });
    await startRace(page);
    const touch = await context.newCDPSession(page);
    const stick = await centerOf(page, '#stick-base');
    const kart = () => page.evaluate(() => window.__game.getState().karts[0]!);

    await finger(touch, 'touchStart', stick.x, stick.y);
    await finger(touch, 'touchMove', stick.x, stick.y - 60);
    await page.waitForTimeout(1000);
    expect((await kart()).speed).toBeGreaterThan(3);

    const yawBeforeLeft = (await kart()).yaw;
    await finger(touch, 'touchMove', stick.x - 60, stick.y - 40);
    await page.waitForTimeout(700);
    const left = (await kart()).yaw - yawBeforeLeft;
    const yawBeforeRight = (await kart()).yaw;
    await finger(touch, 'touchMove', stick.x + 60, stick.y - 40);
    await page.waitForTimeout(700);
    const right = (await kart()).yaw - yawBeforeRight;
    await finger(touch, 'touchEnd', stick.x, stick.y);

    expect(Math.abs(left)).toBeGreaterThan(0.1);
    expect(Math.abs(right)).toBeGreaterThan(0.1);
    expect(Math.sign(left)).toBe(-Math.sign(right));
    await context.close();
  });

  test('the menu button opens the settings, where the touch controls and the layout can be changed and are kept after a reload', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context);
    await tapKey(page, '#btn-menu');
    await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Einstellungen');
    const labels = await page
      .locator('[data-testid=menu] c-button[data-option-id]')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('label')));
    expect(labels).toContain('Touch-Steuerung: Auto-Gas');
    expect(labels).toContain('Touch-Layout: Über dem Bild');

    await page.locator('[data-option-id=touchMode]').tap();
    await expect(page.locator('[data-option-id=touchMode]')).toHaveAttribute('label', 'Touch-Steuerung: Vereinfacht');
    await page.locator('[data-option-id=touchLayout]').tap();
    await expect(page.locator('[data-option-id=touchLayout]')).toHaveAttribute('label', 'Touch-Layout: Geteilter Bildschirm');
    expect(JSON.parse(await page.evaluate(() => window.localStorage.getItem('catkart:touch') ?? '{}'))).toEqual({ mode: 'simple', layout: 'split' });

    await page.reload();
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
    await tapKey(page, '#btn-menu');
    await expect(page.locator('[data-option-id=touchMode]')).toHaveAttribute('label', 'Touch-Steuerung: Vereinfacht');
    await context.close();
  });

  test('the race controls follow the mode: classic shows gas and brake, simple neither, auto only the brake', async ({ browser }) => {
    for (const [mode, gas, brake] of [
      ['auto', false, true],
      ['simple', false, false],
      ['classic', true, true],
    ] as const) {
      const context = await browser.newContext(IPHONE);
      const page = await openPhone(context, { mode, layout: 'overlay' });
      await startRace(page);
      expect(await page.locator('#btn-gas').isVisible(), `${mode}: gas`).toBe(gas);
      expect(await page.locator('#btn-brake').isVisible(), `${mode}: brake`).toBe(brake);
      await context.close();
    }
  });

  test('the layout decides where the race controls sit: over the picture, or in their own half below it', async ({ browser }) => {
    const overlayContext = await browser.newContext(IPHONE);
    const overlay = await openPhone(overlayContext, { mode: 'auto', layout: 'overlay' });
    expect(await dockOf(overlay)).toBe('split');
    await startRace(overlay);
    expect(await dockOf(overlay)).toBe('overlay');
    const overlayCanvas = (await overlay.locator('#game-canvas').boundingBox())!;
    expect(overlayCanvas.height).toBeCloseTo(IPHONE.viewport!.height, 0);
    await overlayContext.close();

    const splitContext = await browser.newContext(IPHONE);
    const split = await openPhone(splitContext, { mode: 'auto', layout: 'split' });
    await startRace(split);
    expect(await dockOf(split)).toBe('split');
    const splitCanvas = (await split.locator('#game-canvas').boundingBox())!;
    const controls = (await split.locator('#touch-controls').boundingBox())!;
    expect(splitCanvas.height).toBeLessThan(IPHONE.viewport!.height * 0.7);
    expect(controls.y).toBeGreaterThanOrEqual(splitCanvas.y + splitCanvas.height - 1);
    await splitContext.close();
  });

  test('lobby and menus always keep the cross below the picture, so it never covers a row', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context, { mode: 'auto', layout: 'overlay' });
    const canvas = (await page.locator('#game-canvas').boundingBox())!;
    const cross = (await page.locator('#dpad').boundingBox())!;
    expect(cross.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    await context.close();
  });

  test('on a tablet nothing joins by itself; a tap on the free slot adds the on-screen controls', async ({ browser }) => {
    const context = await browser.newContext(IPAD);
    const page = await openPhone(context);
    expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(0);
    await expect(page.locator('#touch-controls')).toBeHidden();

    await page.locator('[data-join-slot]').first().tap();
    await expect.poll(() => page.evaluate(() => window.__game.getState().playerCount)).toBe(1);
    await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('#dpad')).toBeHidden();
    await expect(page.locator('#btn-menu')).toBeVisible();
    expect(await dockOf(page)).toBe('overlay');
    await context.close();
  });

  test('every key of the cross and the race is a real button with a name and at least 44 px', async ({ browser }) => {
    const context = await browser.newContext(IPHONE);
    const page = await openPhone(context, { mode: 'classic', layout: 'overlay' });
    const measure = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#touch-controls button')]
          .filter((button) => button.getBoundingClientRect().width > 0)
          .map((button) => ({
            name: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
          })),
      );
    const lobby = await measure();
    expect(lobby.map((key) => key.name)).toEqual(
      expect.arrayContaining(['Einstellungen', 'Nach oben', 'Nach unten', 'Nach links', 'Nach rechts', 'Bestätigen']),
    );
    for (const key of lobby) expect(Math.min(key.width, key.height), key.name).toBeGreaterThanOrEqual(44);

    await startRace(page);
    const race = await measure();
    expect(race.map((key) => key.name)).toEqual(expect.arrayContaining(['Pause', 'Item', 'Drift', 'Gas', 'Bremse']));
    for (const key of race) expect(Math.min(key.width, key.height), key.name).toBeGreaterThanOrEqual(44);
    await context.close();
  });
});
