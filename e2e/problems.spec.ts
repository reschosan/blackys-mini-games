import { expect, test, type Page } from '@playwright/test';
import { joinWithGamepad, openGame, PAD, startRaceWithGamepad, tapButton } from './support/gamepad';

const NATURE_MAP_INDEX = 0;
const GRAPHICS_RESTORE_WAIT_MS = 5000;

async function loseGraphicsContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    const extension = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    (window as unknown as { graphicsContext: WEBGL_lose_context | null | undefined }).graphicsContext = extension;
    extension?.loseContext();
  });
}

const problems = (page: Page) => page.locator('[data-testid=problems]');

test('without WebGL the start screen gives way to a friendly message with a retry button', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/');
  await expect(problems(page).locator('c-header')).toHaveText('Hoppla, dein Browser kann Cat Kart nicht anzeigen');
  await expect(problems(page).locator('c-button')).toHaveAttribute('label', 'Nochmal versuchen');
  await expect(page.locator('#boot-screen')).toHaveCount(0);
});

test('a lost graphics context stops the game with a message, then offers a reload when it does not come back', async ({ page }) => {
  await openGame(page);
  await loseGraphicsContext(page);
  await expect(problems(page).locator('c-header')).toHaveText('Hoppla, die Grafik macht ein Nickerchen');
  await expect(problems(page).locator('c-button')).toHaveCount(0);
  await expect(problems(page).locator('c-button')).toHaveAttribute('label', 'Seite neu laden', { timeout: GRAPHICS_RESTORE_WAIT_MS + 4000 });
});

test('a graphics context that comes back removes the message again', async ({ page }) => {
  await openGame(page);
  await loseGraphicsContext(page);
  await expect(problems(page).locator('c-panel')).toBeVisible();
  await page.evaluate(() => (window as unknown as { graphicsContext: WEBGL_lose_context }).graphicsContext.restoreContext());
  await expect(problems(page).locator('c-panel')).toHaveCount(0);
  await page.waitForTimeout(GRAPHICS_RESTORE_WAIT_MS + 1000);
  await expect(problems(page).locator('c-panel')).toHaveCount(0);
});

test('a lost graphics context pauses a running race', async ({ page }) => {
  await openGame(page);
  await startRaceWithGamepad(page);
  await loseGraphicsContext(page);
  await page.waitForFunction(() => window.__game.getState().phase === 'paused');
  await expect(problems(page).locator('c-panel')).toBeVisible();
});

test('a missing cat model shows a notice that goes away by itself, the cats stay playable as placeholders', async ({ page }) => {
  await page.route('**/models/cat.glb', (route) => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await expect(problems(page).locator('c-alert-banner')).toContainText('Katzenmodell');
  await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15000 });
  await expect(problems(page).locator('c-alert-banner')).toHaveCount(0, { timeout: 12000 });
  expect(await page.evaluate(() => window.__game.getState().phase)).toBe('lobby');
});

test('missing map models show a notice with the map name and the race still starts', async ({ page }) => {
  test.setTimeout(120000);
  await page.route('**/models/!(cat).glb', (route) => route.abort());
  await page.route(/\/models\/(house-interiors|nature-pack|space-pack)\//, (route) => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  expect(await page.evaluate((index) => window.__game.startEnduranceRace(index, false), NATURE_MAP_INDEX)).toBe(true);
  await expect(problems(page).locator('c-alert-banner')).toContainText('Naturpfad', { timeout: 60000 });
  await expect.poll(() => page.evaluate(() => window.__game.getState().mapReady), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.getState().raceTimeSeconds), { timeout: 30000 }).toBeGreaterThan(0);
});

test('audio that cannot start shows a notice once and the game goes on without sound', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = function failingAudioContext() {
      throw new Error('no audio');
    } as unknown as typeof AudioContext;
  });
  await openGame(page);
  await joinWithGamepad(page);
  await expect(problems(page).locator('c-alert-banner')).toContainText('Ton');
  await expect(problems(page).locator('c-alert-banner')).toHaveCount(0, { timeout: 10000 });
  await tapButton(page, PAD.DOWN);
  await expect(problems(page).locator('c-alert-banner')).toHaveCount(0);
  expect(await page.evaluate(() => window.__game.getState().playerCount)).toBe(1);
});
