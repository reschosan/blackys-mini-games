import { expect, test } from '@playwright/test';
import { joinWithGamepad, moveMenuCursorTo, openGame, PAD, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation } from './support/remoteGuest';

// English is the main language, the browser language decides the start, the settings and the lobby switch it.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('the game starts in English', async ({ page }) => {
    await openGame(page);
    await expect(page.locator('[data-testid=lobby] [data-join-slot]').first()).toContainText('Seat 1');
    await expect(page.locator('[data-settings-button]')).toHaveAttribute('label', 'Settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a gamepad switches the language in the settings, every text follows at once and the choice survives a reload', async ({ page }) => {
    await openGame(page);
    await joinWithGamepad(page);
    await tapButton(page, PAD.SELECT);
    await moveMenuCursorTo(page, 'language');
    const entry = page.locator('[data-testid=menu] c-button[active]');
    await expect(entry).toHaveAttribute('label', 'Language: English');
    await tapButton(page, PAD.CROSS);
    await expect(entry).toHaveAttribute('label', 'Sprache: Deutsch');
    await expect(entry).toHaveAttribute('data-option-id', 'language');
    await expect(page.locator('[data-testid=menu] [data-option-id=settingsBack]')).toHaveAttribute('label', 'Zurück');

    await page.reload();
    await page.waitForFunction(() => typeof window.__game?.getState === 'function');
    await expect(page.locator('[data-settings-button]')).toHaveAttribute('label', 'Einstellungen');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('the language button of the lobby switches too (a shortcut for the mouse)', async ({ page }) => {
    await openGame(page);
    await page.locator('[data-language-button]').dispatchEvent('pointerup');
    await expect(page.locator('[data-settings-button]')).toHaveAttribute('label', 'Einstellungen');
  });
});

test.describe('a guest phone', () => {
  test.setTimeout(120_000);

  test('shows its own language while the host stays in German, also in what the host sends', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser, false, true);
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    await closeInvitation(host);
    await expect(guest.locator('[data-testid=guest-lobby] c-cat-preview-card')).toBeVisible({ timeout: 20_000 });
    await guest.locator('[data-guest-language]').dispatchEvent('pointerup');
    await expect(guest.locator('[data-guest-language]')).toHaveAttribute('label', 'Language: English');
    await expect(guest.locator('[data-testid=guest-lobby] c-header').first()).toHaveText('Your cat');
    await expect(host.locator('[data-settings-button]')).toHaveAttribute('label', 'Einstellungen');

    expect(await host.evaluate(() => window.__game.startGameForTest('sumo', false))).toBe(true);
    await expect(guest.locator('#btn-item button')).toHaveText('Shove', { timeout: 30_000 });
    await expect
      .poll(() => guest.evaluate(() => (window.__guest!.getState() as { race: { statusLines: string[] } | null }).race?.statusLines.join(' ') ?? ''), {
        timeout: 30_000,
      })
      .toMatch(/still in/);
    await context.close();
  });
});
