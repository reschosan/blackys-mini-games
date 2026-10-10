import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = process.argv[2] ?? '.dev-screenshots/house-textures';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  await page.goto(process.env.CAT_KART_URL ?? 'http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
  await page.evaluate(() => window.__game.startEnduranceRace(2, true));
  await page.waitForFunction(() => window.__game.getState().houseModelLoaded);
  const captured = new Set();
  const samples = [];
  for (let index = 0; index < 600; index += 1) {
    const state = await page.evaluate(() => window.__game.getState());
    samples.push(state);
    const kart = state.karts[0];
    const height = { ground: 0, first: 60, second: 120 }[kart.levelId];
    if (!captured.has(kart.levelId) && !kart.stairTransitionId && Math.abs(kart.elevation - height) < 1 && state.camera.position[1] > height + 2) {
      captured.add(kart.levelId);
      await page.screenshot({ path: `${output}/${kart.levelId}.png` });
    }
    if (state.phase === 'results') break;
    await page.waitForTimeout(100);
  }
  const report = {
    errors,
    levels: [...captured],
    final: samples.at(-1),
    peakCalls: Math.max(...samples.map((state) => state.rendering.calls)),
    peakTriangles: Math.max(...samples.map((state) => state.rendering.triangles)),
  };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  if (errors.length || captured.size !== 3 || report.final.phase !== 'results') throw new Error('House texture QA failed');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
