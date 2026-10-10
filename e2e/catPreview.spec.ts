import { expect, test } from '@playwright/test';
import { joinWithGamepad, openGame } from './support/gamepad';

test('cat preview renders in the joined lobby slot without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openGame(page);
  await joinWithGamepad(page);
  await expect(page.locator('c-preview-frame canvas')).toBeVisible();

  expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([]);
});
