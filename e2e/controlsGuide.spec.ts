import { expect, test } from '@playwright/test';
import { openGame, PAD, tapButton } from './support/gamepad';

test('lobby button opens the controls overview and back returns to the settings', async ({ page }) => {
  await openGame(page);

  // The lobby rebuilds its DOM every frame, so click by coordinates instead of a stable element.
  const button = await page.evaluate(() => {
    const rect = document.querySelector('[data-controls-button]')!.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(button.x, button.y);

  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Steuerung');
  await expect(page.locator('c-controls-guide svg')).toHaveCount(1);

  await page.locator('[data-option-id="controlsBack"]').click();
  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Einstellungen');

  await page.locator('[data-option-id="settingsBack"]').click();
  await expect(page.locator('[data-testid=menu]')).toBeHidden();
});

test('Select opens the controls overview from the lobby', async ({ page }) => {
  await openGame(page);

  const menuHeader = page.locator('[data-testid=menu] c-header');
  await expect
    .poll(async () => {
      if (!(await menuHeader.isVisible())) await tapButton(page, PAD.SELECT);
      return (await menuHeader.isVisible()) ? menuHeader.textContent() : null;
    })
    .toBe('Einstellungen');
  await page.locator('[data-option-id="controls"]').click();
  await expect(page.locator('c-controls-guide')).toBeVisible();
});
