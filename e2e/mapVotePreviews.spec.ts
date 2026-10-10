import { expect, test, type Page } from '@playwright/test';

async function clickAt(page: Page, selector: string): Promise<void> {
  const point = await page.evaluate((selector) => {
    const rect = document.querySelector(selector)!.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, selector);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
}

function brightPixelShare(page: Page, previewIndex: number): Promise<number> {
  return page.evaluate((index) => {
    const canvas = document.querySelectorAll('[data-map-preview-index] canvas')[index] as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0;
    for (let offset = 0; offset < data.length; offset += 4) if (data[offset]! + data[offset + 1]! + data[offset + 2]! > 90) bright += 1;
    return bright / (data.length / 4);
  }, previewIndex);
}

test('every map preview shows its map and not a black or blank image', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await clickAt(page, '[data-join-slot]');
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-testid=game-vote] [data-game-index="0"]');
  await clickAt(page, '[data-testid=game-vote] [data-game-index="0"]');
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });

  const mapCount = await page.locator('[data-map-preview-index]').count();
  for (let index = 0; index < mapCount; index += 1) {
    await expect.poll(() => brightPixelShare(page, index), { timeout: 15000 }).toBeGreaterThan(0.5);
  }
});
