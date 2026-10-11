import { expect, test, type Page } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, tapButton } from './support/gamepad';

async function moveToRow(page: Page, rowId: string): Promise<void> {
  const activeRow = page.locator('[data-slot]').first().locator('[data-row-id][active]');
  for (let attempt = 0; attempt < 10 && (await activeRow.getAttribute('data-row-id')) !== rowId; attempt += 1) await tapButton(page, PAD.DOWN);
  await expect(activeRow).toHaveAttribute('data-row-id', rowId);
}

test('kart choice after the game vote: wheels only where selectable, saved per device and used in the race', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  await joinWithGamepad(page);
  await expect(page.locator('[data-slot=player] c-setting-row[data-row-id=kartType]')).toHaveCount(0);
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });

  const row = (rowId: string) => page.locator(`[data-slot=player] c-setting-row[data-row-id=${rowId}]`).first();
  await expect(row('kartType')).toHaveAttribute('value', 'Auto');
  await expect(row('wheels')).toHaveAttribute('value', 'Standard');

  await moveToRow(page, 'kartType');
  await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.RIGHT);
  await expect(row('kartType')).toHaveAttribute('value', 'Panzer');
  await expect(page.locator('[data-slot=player] c-setting-row[data-row-id=wheels]')).toHaveCount(0);

  await tapButton(page, PAD.RIGHT);
  await expect(row('kartType')).toHaveAttribute('value', 'Motorrad');
  await moveToRow(page, 'wheels');
  await tapButton(page, PAD.RIGHT);
  await expect(row('wheels')).toHaveAttribute('value', 'Offroad');
  await moveToRow(page, 'kartColor');
  await tapButton(page, PAD.RIGHT);
  await expect(row('kartColor')).toHaveAttribute('value', 'Blau');

  await tapButton(page, PAD.CROSS);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });

  const kart = await page.evaluate(() => window.__game.getState().karts[0]!);
  expect(kart.kartType).toBe('motorcycle');
  expect(kart.wheels).toBe('offroad');

  const saved = await page.evaluate(() => window.localStorage.getItem('blackys-mini-games:kart:gamepad:0'));
  expect(JSON.parse(saved ?? '{}')).toEqual({ kartType: 'motorcycle', wheels: 'offroad', colorIndex: 1 });
  expect(errors).toEqual([]);
});
