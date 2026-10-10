import { expect, test } from '@playwright/test';

const RACE_COUNT = 50;
const MAX_HEAP_GROWTH_BYTES = 32 * 1024 * 1024;

test('runs 50 all-AI races without reload, stalled simulation or uncontrolled heap growth', async ({ page }) => {
  test.setTimeout(2_400_000);
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.startEnduranceRace === 'function');
  await page.waitForLoadState('networkidle');

  let previousTicks = 0;
  let previousRenderedFrames = 0;
  let warmHeapBytes: number | null = null;
  let finalHeapBytes: number | null = null;

  for (let raceNumber = 1; raceNumber <= RACE_COUNT; raceNumber += 1) {
    const mapIndex = ((raceNumber - 1) % 2) * 2;
    const started = await page.evaluate((index) => window.__game.startEnduranceRace(index), mapIndex);
    expect(started, `Race ${raceNumber}: start rejected`).toBe(true);

    try {
      await page.waitForFunction(
        (expectedMap) => {
          const state = window.__game.getState();
          return state.phase === 'results' && state.mapName === expectedMap;
        },
        mapIndex === 0 ? 'Naturpfad' : 'Mondbasis',
        { timeout: 90_000 },
      );
    } catch (error) {
      const state = await page.evaluate(() => window.__game.getState());
      throw new Error(`Race ${raceNumber}, map ${mapIndex}, snapshot ${JSON.stringify(state)}`, { cause: error });
    }

    const state = await page.evaluate(() => window.__game.getState());
    expect(state.runtime.simulationTicks, `Race ${raceNumber}: simulation stopped`).toBeGreaterThan(previousTicks);
    previousTicks = state.runtime.simulationTicks;
    expect(state.runtime.renderedFrames, `Race ${raceNumber}: no rendered frames`).toBeGreaterThan(previousRenderedFrames);
    previousRenderedFrames = state.runtime.renderedFrames;
    expect(state.runtime.averageFrameMilliseconds, `Race ${raceNumber}: missing frame metric`).not.toBeNull();

    if (raceNumber === 5) warmHeapBytes = state.runtime.heapBytes;
    if (raceNumber === RACE_COUNT) finalHeapBytes = state.runtime.heapBytes;
  }

  if (warmHeapBytes !== null && finalHeapBytes !== null) {
    expect(finalHeapBytes - warmHeapBytes, 'Heap grew beyond the 32 MiB post-warm-up limit').toBeLessThanOrEqual(MAX_HEAP_GROWTH_BYTES);
  }
  expect(problems, `Console errors: ${problems.join('\n')}`).toEqual([]);
});
