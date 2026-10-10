import { expect, test, type Page } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, phaseOf, tapButton } from './support/gamepad';

async function joinWithOneAiAndGetReady(page: Page): Promise<void> {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.START);
  await expect(page.locator('[data-slot=ai], [data-slot=ai-focused]')).toHaveCount(1);
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-slot=ai-focused]')).toHaveCount(1);
}

test('"Zurück" on the first AI kart hands control back to player one, who is no longer ready', async ({ page }) => {
  await joinWithOneAiAndGetReady(page);

  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.RIGHT);
  await expect(page.locator('[data-ai-wizard-rows] c-setting-row').nth(1)).toHaveAttribute('value', 'Zurück');
  await tapButton(page, PAD.CROSS);

  await expect(page.locator('[data-slot=ai-focused]')).toHaveCount(0);
  await expect(page.locator('[data-slot=player] c-button[data-row-id=ready]')).toHaveAttribute('label', 'Bereit');
  await expect(page.locator('[data-slot=player] [data-row-id][active]')).toBeVisible();
  expect(await phaseOf(page)).toBe('lobby');
});

test('after going back, the next "Bereit" starts the AI setup with "Bereit" selected again', async ({ page }) => {
  await joinWithOneAiAndGetReady(page);
  await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.RIGHT);
  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-slot=ai-focused]')).toHaveCount(0);

  await tapButton(page, PAD.CROSS);
  await expect(page.locator('[data-slot=ai-focused]')).toHaveCount(1);
  await expect(page.locator('[data-ai-wizard-rows] c-setting-row').nth(1)).toHaveAttribute('value', 'Bereit');
});
