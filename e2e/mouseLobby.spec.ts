import { expect, test, type Page } from '@playwright/test';

// The lobby rebuilds its DOM every frame, so clicks go by coordinates instead of a stable element.
async function clickAt(page: Page, selector: string, index = 0): Promise<void> {
  const point = await page.evaluate(
    ({ selector, index }) => {
      const rect = document.querySelectorAll(selector)[index]!.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    { selector, index },
  );
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
}

test('a whole race can be started with the mouse alone', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');

  await clickAt(page, '[data-join-slot]');
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);

  await clickAt(page, '[data-ai-fill-button]');
  await expect(page.locator('[data-ai-fill-button]')).toHaveText('KI-Gegner: 1');

  await clickAt(page, '[data-slot=player] c-button[data-row-id=ready]');
  await expect(page.locator('[data-slot=ai-focused]')).toBeVisible();

  await clickAt(page, '[data-slot=ai-focused] [data-row-index="1"]');
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-testid=game-vote] c-map-vote-card', 0);
  await clickAt(page, '[data-testid=game-vote] c-map-vote-card', 0);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await clickAt(page, '[data-player-index="0"] c-button[data-row-id=ready]');
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });

  await clickAt(page, 'c-map-vote-card', 1);
  await clickAt(page, 'c-map-vote-card', 1);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
});

test('the lobby settings button opens the settings menu', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');

  await clickAt(page, '[data-settings-button]');

  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Einstellungen');
});
