import { expect, test, type Page } from '@playwright/test';
import { holdButton, joinWithGamepad, openGame, PAD, setAxis, tapButton } from './support/gamepad';

const STICK_VERTICAL_AXIS = 1;
const SCROLL_HOLD_MS = 700;

async function openAboutPage(page: Page): Promise<void> {
  await page.locator('[data-about-button]').click();
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Über Blacky');
  await page.waitForTimeout(200);
}

const scrollTopOf = (page: Page) => page.evaluate(() => document.querySelector('[data-testid=menu] c-scroll')?.scrollTop ?? -1);

test('a gamepad scrolls the about page with the D-pad and the stick, and the cross goes back', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await openAboutPage(page);
  expect(await scrollTopOf(page)).toBe(0);

  await holdButton(page, PAD.DOWN, true);
  await page.waitForTimeout(SCROLL_HOLD_MS);
  await holdButton(page, PAD.DOWN, false);
  const afterDpad = await scrollTopOf(page);
  expect(afterDpad).toBeGreaterThan(150);

  const stopped = await scrollTopOf(page);
  await page.waitForTimeout(300);
  expect(await scrollTopOf(page)).toBe(stopped);

  await holdButton(page, PAD.UP, true);
  await page.waitForTimeout(SCROLL_HOLD_MS);
  await holdButton(page, PAD.UP, false);
  expect(await scrollTopOf(page)).toBeLessThan(afterDpad);

  await setAxis(page, STICK_VERTICAL_AXIS, 1);
  await page.waitForTimeout(SCROLL_HOLD_MS);
  await setAxis(page, STICK_VERTICAL_AXIS, 0);
  expect(await scrollTopOf(page)).toBeGreaterThan(150);

  await tapButton(page, PAD.UP);
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Über Blacky');

  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Einstellungen');
});

test('up does not confirm on pages that do not scroll, only the cross goes back', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await page.locator('[data-settings-button]').click();
  await page.locator('[data-option-id=credits]').click();
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Mitwirkende');
  await page.waitForTimeout(200);
  await tapButton(page, PAD.UP);
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Mitwirkende');
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Einstellungen');
});

test('the controls page fits the window with its "Zurück" button and scrolls with the D-pad', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openGame(page);
  await joinWithGamepad(page);
  await page.locator('[data-controls-button]').click();
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Steuerung');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid=menu] c-button[data-option-id=controlsBack]')).toBeInViewport();
  expect(await scrollTopOf(page)).toBe(0);

  await holdButton(page, PAD.DOWN, true);
  await page.waitForTimeout(SCROLL_HOLD_MS);
  await holdButton(page, PAD.DOWN, false);
  expect(await scrollTopOf(page)).toBeGreaterThan(100);
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Einstellungen');
});
