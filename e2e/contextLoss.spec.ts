import { expect, test, type Page } from '@playwright/test';
import { installFakeGamepads, PAD, startRaceWithGamepad, tapButton } from './support/gamepad';

test.setTimeout(180000);

async function backToLobby(page: Page): Promise<void> {
  await tapButton(page, PAD.START);
  for (let step = 0; step < 4; step += 1) await tapButton(page, PAD.DOWN);
  await tapButton(page, PAD.CROSS);
  await page.waitForFunction(() => window.__game.getState().phase === 'lobby', undefined, { timeout: 5000 });
}

test('repeated lobby, vote and race rounds keep the main WebGL context alive (previews release their own)', async ({ page }) => {
  await page.addInitScript(() => {
    const lost: string[] = [];
    (window as unknown as { __lostContexts: string[] }).__lostContexts = lost;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      const context = original.apply(this, args);
      if (context && args[0]?.toString().startsWith('webgl')) this.addEventListener('webglcontextlost', () => lost.push(this.id || 'unnamed'));
      return context;
    } as typeof original;
  });
  await installFakeGamepads(page);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');

  for (let round = 0; round < 6; round += 1) {
    await startRaceWithGamepad(page);
    await backToLobby(page);
  }
  const lost = await page.evaluate(() => (window as unknown as { __lostContexts: string[] }).__lostContexts);
  expect(lost.filter((id) => id === 'game-canvas')).toEqual([]);
  expect(await page.evaluate(() => document.querySelector<HTMLCanvasElement>('#game-canvas')?.getContext('webgl2')?.isContextLost())).toBe(false);
});
