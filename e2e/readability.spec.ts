import { expect, test, type Page } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, tapButton } from './support/gamepad';

const MIN_REM = 0.95;
const WINDOW_SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const ROUNDING_TOLERANCE_PX = 0.3;

async function smallestVisibleText(page: Page): Promise<{ sizePx: number; text: string; rootPx: number }> {
  return page.evaluate(() => {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    let smallest = { sizePx: Infinity, text: '' };
    const walker = document.createTreeWalker(document.querySelector('#overlay')!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest('[hidden]')) continue;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
      const sizePx = parseFloat(style.fontSize);
      if (sizePx < smallest.sizePx) smallest = { sizePx, text: text.slice(0, 30) };
    }
    return { ...smallest, rootPx };
  });
}

async function expectReadable(page: Page, where: string): Promise<void> {
  const { sizePx, text, rootPx } = await smallestVisibleText(page);
  expect(sizePx, `${where}: "${text}" is ${sizePx}px, root ${rootPx}px`).toBeGreaterThanOrEqual(MIN_REM * rootPx - ROUNDING_TOLERANCE_PX);
}

for (const size of WINDOW_SIZES) {
  test(`no text is smaller than ${MIN_REM}rem in the lobby, settings, vote, pause and race at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openGame(page, 2);
    await expectReadable(page, 'empty lobby');

    await joinWithGamepad(page, 0);
    await joinWithGamepad(page, 1);
    await page.locator('[data-ai-fill-button]').click();
    await page.waitForTimeout(300);
    await expectReadable(page, 'lobby with players');

    await tapButton(page, PAD.SELECT);
    await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Einstellungen');
    await expectReadable(page, 'settings');

    await page.reload();
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await page.waitForLoadState('networkidle');
    await joinWithGamepad(page);
    await tapButton(page, PAD.CROSS);
    await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
    await expectReadable(page, 'game vote');
    await tapButton(page, PAD.CROSS);
    await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
    await expectReadable(page, 'kart page');
    await tapButton(page, PAD.CROSS);
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
    await expectReadable(page, 'map vote');
    await tapButton(page, PAD.CROSS);
    await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
    await page.waitForTimeout(1500);
    await expectReadable(page, 'race HUD');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => window.__game.getState().phase === 'paused');
    await expectReadable(page, 'pause menu');
  });
}
