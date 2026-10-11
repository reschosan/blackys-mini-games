import { expect, test } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, tapButton } from './support/gamepad';

test('opens persistent audio settings from the lobby', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.SELECT);
  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Einstellungen');

  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Ton');
  await tapButton(page, PAD.CROSS);
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('blackys-mini-games:audio') ?? '{}').muted)).toBe(false);

  await tapButton(page, PAD.DOWN);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'musicDown');
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'musicDown');
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'musicDown');

  for (let step = 0; step < 4; step += 1) await tapButton(page, PAD.RIGHT);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'audioBack');
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Einstellungen');
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'audio');
});
