import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { loadHouseConfiguration } from './houseConfiguration.mjs';

if (process.argv.includes('--help')) {
  console.log('Capture an accelerated four-AI house race, each floor and the finish. CAT_KART_URL overrides localhost:5173.');
  process.exit(0);
}
const output = '.dev-screenshots';
const normal = process.argv.includes('--normal');
const map = await loadHouseConfiguration();
const floorHeights = Object.fromEntries(map.levels.map((level) => [level.id, level.floorHeight]));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: output, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const samples = [];
const captured = new Set();
try {
  await page.goto(process.env.CAT_KART_URL ?? 'http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
  await page.evaluate((accelerated) => window.__game.startEnduranceRace(2, accelerated), !normal);
  await page.waitForFunction(() => window.__game.getState().houseModelLoaded);
  for (let tick = 0; tick < (normal ? 4200 : 300); tick += 1) {
    const state = await page.evaluate(() => window.__game.getState());
    samples.push(state);
    const level = state.karts[0]?.levelId;
    const kart = state.karts[0];
    const camera = state.camera.position;
    const settled =
      !kart?.stairTransitionId &&
      Math.abs((kart?.elevation ?? 0) - (floorHeights[level] ?? 0)) < 1 &&
      camera[1] > (floorHeights[level] ?? 0) + 2 &&
      Math.hypot(camera[0] - kart.x, camera[2] - kart.z) < 30;
    if (level && !captured.has(level) && settled) {
      captured.add(level);
      await page.screenshot({ path: `${output}/house-${level}.png` });
    }
    if (state.phase === 'results') {
      await page.screenshot({ path: `${output}/house-finish.png` });
      break;
    }
    await page.waitForTimeout(100);
  }
  await writeFile(`${output}/house-race-report.json`, JSON.stringify({ errors, levels: [...captured], final: samples.at(-1), samples }, null, 2));
  if (errors.length || captured.size !== 3 || samples.at(-1)?.phase !== 'results')
    throw new Error('House browser race did not complete cleanly. See house-race-report.json.');
  console.log(JSON.stringify({ errors, levels: [...captured], final: samples.at(-1) }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
