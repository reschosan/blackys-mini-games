import { expect, test } from '@playwright/test';

test('lobby button opens the about page without photos and back returns to the settings', async ({ page }) => {
  const photoRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/images/blacky/')) photoRequests.push(request.url());
  });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');

  const button = await page.evaluate(() => {
    const rect = document.querySelector('[data-about-button]')!.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(button.x, button.y);

  await expect(page.locator('[data-testid=menu] > c-header')).toHaveText('Über Blacky');
  const story = page.locator('[data-testid=menu] c-scroll');
  await expect(story).toContainText('Ich widme dieses Projekt meinem Kater Blacky.');
  await expect(story).toContainText('Was ist das eigentlich?');
  await expect(story.locator('img')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(photoRequests).toEqual([]);
  await page.locator('.lil-gui.root').evaluate((panel) => {
    (panel as HTMLElement).style.display = 'none';
  });
  await page.screenshot({ path: 'artifacts/about-page-top.png' });
  await story.evaluate((area) => {
    area.scrollTop = area.scrollHeight;
  });
  await expect(story).toContainText('Much love, Reschosan');
  await page.screenshot({ path: 'artifacts/about-page.png' });

  await page.locator('[data-option-id="aboutBack"]').click();
  await expect(page.locator('[data-testid=menu] c-header')).toHaveText('Einstellungen');
});
