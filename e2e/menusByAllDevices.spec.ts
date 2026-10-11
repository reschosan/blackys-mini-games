import { expect, test, type Page } from '@playwright/test';
import { goToRow, holdButton, joinWithGamepad, moveMenuCursorTo, openFullCard, openGame, PAD, startRaceWithGamepad, tapButton } from './support/gamepad';

const RACE_START_SETTLE_MS = 2000;
const LONG_TAP_MS = 400;

const menuTitle = (page: Page) => page.locator('[data-testid=menu] > c-header');

test('a gamepad reaches "Über Blacky", "Mitwirkende" and "Datenschutz" from the lobby settings', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.SELECT);
  await expect(menuTitle(page)).toHaveText('Einstellungen');

  await moveMenuCursorTo(page, 'about');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Über Blacky');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'about');

  await tapButton(page, PAD.RIGHT);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'credits');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Mitwirkende');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Einstellungen');

  await tapButton(page, PAD.RIGHT);
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'privacy');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Datenschutz');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'privacy');
});

test('"Über Blacky" and "Mitwirkende" can be opened from the pause menu settings too and lead back to them', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await page.waitForTimeout(RACE_START_SETTLE_MS);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__game.getState().phase === 'paused');
  await page.locator('[data-option-id="settings"]').click();
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  await page.locator('[data-option-id="about"]').click();
  await expect(menuTitle(page)).toHaveText('Über Blacky');
  await page.locator('[data-option-id="aboutBack"]').click();
  await expect(menuTitle(page)).toHaveText('Einstellungen');
});

test('the cross confirms in the pause menu like in the lobby', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await page.waitForTimeout(RACE_START_SETTLE_MS);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__game.getState().phase === 'paused');
  await expect(page.locator('[data-testid=menu]')).toBeVisible();
  await expect
    .poll(
      async () => {
        await holdButton(page, PAD.CROSS, true);
        await page.waitForTimeout(LONG_TAP_MS);
        await holdButton(page, PAD.CROSS, false);
        await page.waitForTimeout(200);
        return page.evaluate(() => window.__game.getState().phase);
      },
      { timeout: 20000, intervals: [0] },
    )
    .toBe('racing');
});

test('menus opened from the lobby are opaque so the lobby does not shine through the buttons', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.SELECT);
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  const alpha = (selector: string) =>
    page.evaluate((sel) => {
      const color = getComputedStyle(document.querySelector(sel) as Element).backgroundColor;
      const match = color.match(/rgba?\(([^)]+)\)/);
      const parts = match ? match[1]!.split(/[ ,/]+/).filter(Boolean) : [];
      return parts.length > 3 ? Number(parts[3]) : 1;
    }, selector);
  expect(await alpha('[data-testid=menu]')).toBe(1);
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Ton');
  expect(await alpha('[data-testid=menu]')).toBe(1);
});

test('a gamepad switches the graphics level in the settings, the entry stays selected and the choice survives a reload', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  const level = () => page.evaluate(() => window.__game.getState().graphicsQuality);
  const startLevel = await level();
  await tapButton(page, PAD.SELECT);
  await tapButton(page, PAD.RIGHT);
  const graphicsEntry = page.locator('[data-testid=menu] c-button[active]');
  await expect(graphicsEntry).toHaveAttribute('data-option-id', 'graphics');
  await tapButton(page, PAD.CROSS);
  await expect.poll(level).not.toBe(startLevel);
  await expect(graphicsEntry).toHaveAttribute('data-option-id', 'graphics');
  const switched = await level();
  await expect(graphicsEntry).toContainText(switched === 'low' ? 'Niedrig' : 'Hoch');

  await page.reload();
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  expect(await level()).toBe(switched);
});

test('a gamepad picks a cat name with the arrows: up from the first row selects the name, right suggests the next free one', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  const tag = page.locator('c-player-tag');
  const firstName = (await tag.textContent())?.trim() ?? '';
  expect(firstName).not.toBe('');

  await openFullCard(page);
  await goToRow(page, 'name');
  await tapButton(page, PAD.RIGHT);
  await expect(tag).not.toHaveText(firstName);
  const secondName = (await tag.textContent())?.trim() ?? '';
  await tapButton(page, PAD.RIGHT);
  await expect(tag).not.toHaveText(secondName);
  const thirdName = (await tag.textContent())?.trim() ?? '';

  await page.reload();
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await joinWithGamepad(page);
  await expect(tag).toHaveText(thirdName);
});

test('two gamepads never end up with the same cat name', async ({ page }) => {
  await openGame(page, 2);
  await joinWithGamepad(page, 0);
  await joinWithGamepad(page, 1);
  const names = await page.locator('c-player-tag').allTextContents();
  expect(new Set(names.map((name) => name.trim())).size).toBe(2);

  await tapButton(page, PAD.CROSS, 0);
  await tapButton(page, PAD.CROSS, 1);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS, 0);
  await tapButton(page, PAD.CROSS, 1);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  await goToRow(page, 'name', 0);
  for (let step = 0; step < 12; step += 1) {
    await tapButton(page, PAD.RIGHT, 0);
    const current = (await page.locator('c-player-tag').allTextContents()).map((name) => name.trim());
    expect(new Set(current).size).toBe(2);
  }
});

test('the lobby hint tells how to get ready and where the help is', async ({ page }) => {
  await openGame(page);
  const hint = page.locator('[data-testid=lobby]');
  await expect(hint).toContainText('Bereit: ✕');
  await expect(hint).toContainText('Einstellungen › Steuerung');
});

test('the settings list stands vertically and moves with up/down on the gamepad', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  await tapButton(page, PAD.SELECT);
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  const optionTops = await page
    .locator('[data-testid=menu] c-button[data-option-id]')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
  expect(optionTops).toEqual([...optionTops].sort((first, second) => first - second));
  expect(new Set(optionTops).size).toBe(optionTops.length);

  const active = page.locator('[data-testid=menu] c-button[active]');
  await tapButton(page, PAD.DOWN);
  await expect(active).toHaveAttribute('data-option-id', 'graphics');
  await tapButton(page, PAD.UP);
  await expect(active).toHaveAttribute('data-option-id', 'audio');
  await tapButton(page, PAD.R);
  await expect(active).toHaveAttribute('data-option-id', 'graphics');
  await tapButton(page, PAD.L);
  await expect(active).toHaveAttribute('data-option-id', 'audio');
  await expect(menuTitle(page)).toHaveText('Einstellungen');
  await tapButton(page, PAD.CROSS);
  await expect(menuTitle(page)).toHaveText('Ton');
});

test('the lobby is opaque, so no kart of the scene behind it shines through the empty slots', async ({ page }) => {
  await openGame(page);
  await joinWithGamepad(page);
  const alpha = await page.evaluate(() => {
    const color = getComputedStyle(document.querySelector('[data-testid=lobby]') as Element).backgroundColor;
    const slashAlpha = color.match(/\/\s*([\d.]+)\s*\)/)?.[1];
    return slashAlpha === undefined ? 1 : Number(slashAlpha);
  });
  expect(alpha).toBe(1);
});

test('the sound starts off and is switched on right in the pause menu, the entry stays selected', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await page.waitForTimeout(RACE_START_SETTLE_MS);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__game.getState().phase === 'paused');
  const soundEntry = page.locator('[data-testid=menu] [data-option-id="pauseSound"]');
  await expect(soundEntry).toContainText('Ton einschalten');

  await moveMenuCursorTo(page, 'pauseSound');
  await expect
    .poll(
      async () => {
        if ((await soundEntry.textContent())?.includes('einschalten')) await tapButton(page, PAD.CROSS);
        return soundEntry.textContent();
      },
      { timeout: 10_000 },
    )
    .toContain('Ton ausschalten');
  await expect(page.locator('[data-testid=menu] c-button[active]')).toHaveAttribute('data-option-id', 'pauseSound');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('blackys-mini-games:audio') ?? '{}').muted)).toBe(false);
  expect(await page.evaluate(() => window.__game.getState().phase)).toBe('paused');
});
