import { devices, expect, test, type Page } from '@playwright/test';
import { chooseDefaultGame, goToRow, joinWithGamepad, openFullCard, openGame, PAD, tapButton } from './support/gamepad';

const SCREENS = [
  { name: 'laptop 720p', width: 1280, height: 720, sizeClass: 'M' },
  { name: 'laptop 768p', width: 1366, height: 768, sizeClass: 'M' },
  { name: '15 inch 900p', width: 1440, height: 900, sizeClass: 'L' },
  { name: 'iPad landscape', width: 1024, height: 768, sizeClass: 'M' },
  { name: 'iPad upright', width: 768, height: 1024, sizeClass: 'M' },
  { name: 'iPad landscape, Safari bars showing', width: 1024, height: 650, sizeClass: 'M' },
  { name: 'iPad upright, Safari bars showing', width: 768, height: 900, sizeClass: 'M' },
  { name: 'iPad Air landscape', width: 1180, height: 820, sizeClass: 'L' },
  { name: 'desktop 1080p', width: 1920, height: 1080, sizeClass: 'XL' },
] as const;

async function openLobby(page: Page): Promise<void> {
  await openGame(page, 2);
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
}

async function voteReady(page: Page): Promise<void> {
  await tapButton(page, PAD.CROSS);
  await chooseDefaultGame(page);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
}

/** Everything matching `selector` lies fully inside the window (no clipping at any edge). */
async function expectInsideWindow(page: Page, selector: string): Promise<void> {
  const outside = await page.evaluate(
    (query) =>
      [...document.querySelectorAll(query)].flatMap((element) => {
        const box = element.getBoundingClientRect();
        const fits = box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
        return fits ? [] : [`${query}: ${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)}`];
      }),
    selector,
  );
  expect(outside, `window ${await page.evaluate(() => `${innerWidth}x${innerHeight}`)}`).toEqual([]);
}

for (const screen of SCREENS) {
  test(`${screen.name}: lobby and map vote fit the window without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await openLobby(page);
    expect(await page.evaluate(() => document.documentElement.dataset.screenSize)).toBe(screen.sizeClass);

    await joinWithGamepad(page, 0);
    await joinWithGamepad(page, 1);
    await expect(page.locator('[data-slot=player]')).toHaveCount(2);
    for (const selector of ['[data-slot]', '[data-graphics-button]', '[data-settings-button]', '[data-controls-button]', '[data-about-button]']) {
      await expectInsideWindow(page, selector);
    }
    expect(await page.evaluate(() => document.querySelector('[data-testid=lobby]')!.scrollHeight <= innerHeight + 1)).toBe(true);

    await page.reload();
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
    await joinWithGamepad(page, 0);
    await voteReady(page);
    for (const selector of ['c-map-vote-card', '[data-back-button]']) await expectInsideWindow(page, selector);
  });
}

test('iPad landscape: the gamepad can reveal the Ready row on the kart page', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openLobby(page);
  await joinWithGamepad(page);
  await openFullCard(page);
  await goToRow(page, 'ready');
  await expectInsideWindow(page, '[data-slot=player] [data-row-id=ready]');
});

const PHONES = [
  { name: 'phone upright', width: 390, height: 844 },
  { name: 'small phone upright', width: 320, height: 568 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'small phone landscape', width: 568, height: 320 },
] as const;

const MIN_READABLE_ROOT_FONT_PX = 11;
const MIN_TOUCH_TARGET_PX = 44;

async function scrollToEnd(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => element.scrollTo(0, element.scrollHeight));
}

for (const phone of PHONES) {
  test(`${phone.name}: readable text, no sideways overflow, everything reachable by scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await openLobby(page);
    expect(await page.evaluate(() => document.documentElement.dataset.screenSize)).toBe('S');
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeGreaterThanOrEqual(MIN_READABLE_ROOT_FONT_PX);

    await joinWithGamepad(page);
    await expect(page.locator('[data-slot=player]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.querySelector('[data-testid=lobby]')!.scrollWidth <= innerWidth + 1)).toBe(true);
    await scrollToEnd(page, '[data-testid=lobby]');
    for (const selector of ['[data-graphics-button]', '[data-settings-button]', '[data-controls-button]', '[data-about-button]']) {
      await expectInsideWindow(page, selector);
    }

    await voteReady(page);
    expect(await page.evaluate(() => document.querySelector('[data-testid=map-vote]')!.scrollWidth <= innerWidth + 1)).toBe(true);
    await scrollToEnd(page, '[data-testid=map-vote]');
    await expectInsideWindow(page, '[data-back-button]');
  });
}

test('upright on a phone the map cards sit two per row instead of one long column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLobby(page);
  await joinWithGamepad(page);
  await voteReady(page);
  const firstRowCards = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('c-map-vote-card')].map((card) => Math.round(card.getBoundingClientRect().top));
    return tops.filter((top) => top === tops[0]).length;
  });
  expect(firstRowCards).toBeGreaterThanOrEqual(2);
});

test('on a touch screen every button of the lobby is at least 44px high', async ({ browser, baseURL }) => {
  const { defaultBrowserType: _ignored, ...profile } = devices['iPad (gen 7)'];
  const context = await browser.newContext({ ...profile, ...(baseURL ? { baseURL } : {}) });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
    await page.waitForTimeout(500);
    const tooSmall = await page.evaluate(
      (minimum) =>
        [...document.querySelectorAll('c-button button')].flatMap((button) => {
          const box = button.getBoundingClientRect();
          return box.width > 0 && box.height < minimum - 0.5 ? [`${button.textContent?.trim()} ${Math.round(box.height)}px`] : [];
        }),
      MIN_TOUCH_TARGET_PX,
    );
    expect(tooSmall).toEqual([]);
  } finally {
    await context.close();
  }
});

test('the lobby no longer carries the long explanation, the controls page has it', async ({ page }) => {
  await openLobby(page);
  await expect(page.locator('[data-testid=lobby]')).not.toContainText('Hoch/Runter');
  await page.evaluate(() => document.querySelector('[data-controls-button]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await expect(page.locator('c-controls-guide')).toBeVisible();
  await expect(page.locator('#overlay')).toContainText('Hoch/Runter');
});

test('an empty slot asks for a gamepad press or a tap and the lobby has no QR code or room code any more', async ({ page }) => {
  await openLobby(page);
  await expect(page.locator('[data-slot=empty]')).toHaveCount(4);
  await expect(page.locator('[data-slot=empty]').first()).toContainText('Gamepad-Knopf drücken oder hier antippen');
  await expect(page.locator('[data-room-code], c-invite-card, img[alt*=QR]')).toHaveCount(0);

  await joinWithGamepad(page);
  await expect(page.locator('[data-slot=empty]')).toHaveCount(3);
});

test('the frame rate readout and the lobby buttons are on screen on every tablet size, upright and sideways', async ({ page }) => {
  for (const screen of SCREENS.filter((candidate) => candidate.name.includes('iPad'))) {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await openLobby(page);
    await joinWithGamepad(page);
    await expect(page.locator('[data-slot=player]')).toHaveCount(1);
    await expectInsideWindow(page, 'c-perf-readout');
    await scrollToEnd(page, '[data-testid=lobby]');
    for (const selector of ['[data-graphics-button]', '[data-settings-button]', '[data-controls-button]', '[data-about-button]']) {
      await expectInsideWindow(page, selector);
    }
  }
});

test('in the map vote the card the cursor moves to is on screen, also when the map list is longer than the window', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 420 });
  await openLobby(page);
  await joinWithGamepad(page);
  await voteReady(page);
  const cardCount = await page.locator('c-map-vote-card').count();
  expect(await page.evaluate(() => document.querySelector('[data-testid=map-vote]')!.scrollHeight > innerHeight)).toBe(true);

  for (let step = 0; step < cardCount; step += 1) await tapButton(page, PAD.RIGHT);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector('[data-back-button]')!.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight - 8;
      }),
    )
    .toBe(true);
});
