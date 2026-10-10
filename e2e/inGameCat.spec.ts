import { test } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, tapButton } from './support/gamepad';

test('idle head sway while parked', async ({ page }) => {
  await openGame(page);

  await joinWithGamepad(page);
  await tapButton(page, PAD.START);
  await page.waitForTimeout(500);

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas box');
  const clip = { x: box.x + box.width * 0.32, y: box.y + box.height * 0.35, width: box.width * 0.36, height: box.height * 0.3 };

  await page.screenshot({ path: '.dev-screenshots/idle-head-1.png', clip });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '.dev-screenshots/idle-head-2.png', clip });
});
