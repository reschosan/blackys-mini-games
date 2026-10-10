import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { loadHouseConfiguration } from './houseConfiguration.mjs';

const map = await loadHouseConfiguration();
const furnitureCheck = process.argv.includes('--furniture');
const output = furnitureCheck ? '.dev-screenshots/house-furniture' : `.dev-screenshots/house-feedback-${process.argv.includes('--after') ? 'after' : 'before'}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const reports = [];
try {
  for (const scenario of furnitureCheck ? ['furniture'] : ['late-turn', 'early-turn', 'slow-window']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.CAT_KART_URL ?? 'http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');
    await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
    const tap = async (key) => {
      await page.keyboard.down(key);
      await page.waitForTimeout(120);
      await page.keyboard.up(key);
      await page.waitForTimeout(120);
    };
    await tap('w');
    for (let index = 0; index < 8; index += 1) {
      if ((await page.locator('[data-row-id][active]').getAttribute('data-row-id')) === 'ready') break;
      await tap('s');
    }
    await tap('d');
    await tap('Tab');
    await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
    await tap('d');
    await tap('d');
    await tap('Tab');
    await page.waitForFunction(() => window.__game.getState().phase === 'racing');
    await page.waitForFunction(() => window.__game.getState().houseModelLoaded);
    await page.waitForTimeout(3600);
    await page.screenshot({ path: `${output}/${scenario}-start.png` });
    const samples = [];
    const nodes =
      scenario === 'furniture'
        ? [
            { x: -63, z: 86.4 },
            { x: -15, z: 86.4 },
            { x: -15, z: 70 },
            { x: -15, z: 50 },
          ]
        : scenario === 'early-turn'
          ? [
              { x: -63, z: 86.4 },
              { x: -39, z: 86.4 },
              { x: -39, z: 105 },
              { x: -27, z: 119.4 },
            ]
          : map.routeNodes;
    let index = 1;
    let captured = false;
    for (let tick = 0; tick < (scenario === 'late-turn' ? 60 : 220); tick += 1) {
      const state = await page.evaluate(() => window.__game.getState());
      samples.push(state);
      const kart = state.karts[0];
      let steer = 0;
      let accelerate = true;
      let brake = false;
      if (scenario !== 'late-turn') {
        while (index < 3 && Math.hypot(nodes[index].x - kart.x, nodes[index].z - kart.z) < 1.5) index += 1;
        const target = nodes[index];
        const angle = Math.atan2(
          Math.sin(Math.atan2(target.z - kart.z, target.x - kart.x) - kart.yaw),
          Math.cos(Math.atan2(target.z - kart.z, target.x - kart.x) - kart.yaw),
        );
        steer = Math.abs(angle) > 0.1 ? Math.sign(angle) : 0;
        brake = kart.speed > 5;
        accelerate = kart.speed < 4;
      }
      for (const [key, pressed] of [
        ['w', accelerate],
        ['s', brake],
        ['a', steer < 0],
        ['d', steer > 0],
      ])
        await page.keyboard[pressed ? 'down' : 'up'](key);
      if (
        !captured &&
        ((scenario === 'late-turn' && tick > 30 && kart.speed < 2) ||
          (['early-turn', 'furniture'].includes(scenario) && tick > 120 && kart.speed < 2) ||
          kart.penaltySecondsLeft > 0)
      ) {
        captured = true;
        await page.screenshot({ path: `${output}/${scenario}-problem.png` });
      }
      await page.waitForTimeout(100);
      if (scenario === 'slow-window' && captured && kart.windowJumpId === null && kart.z > 110) break;
    }
    await page.screenshot({ path: `${output}/${scenario}-end.png` });
    const penalty = samples.find((state) => state.karts[0].penaltySecondsLeft > 0)?.karts[0];
    const final = samples.at(-1);
    const rates = samples.map((state) => state.runtime.fps).sort((a, b) => a - b);
    const metrics = {
      medianFps: rates[Math.floor(rates.length / 2)],
      penaltyAtZ: penalty?.z ?? null,
      warningSeen: samples.some((state) => state.karts[0].drivingHint === 'Fenster: mehr Anlauf!'),
    };
    reports.push({ scenario, errors, captured, metrics, samples });
    console.log(JSON.stringify({ scenario, errors, captured, metrics, final }));
    if (furnitureCheck && (errors.length || !captured || final.karts[0].x < -33 || final.karts[0].x > -15 || final.karts[0].speed > 1))
      throw new Error('Visible route boundary did not stop the off-route approach');
    if (process.argv.includes('--after') && scenario === 'late-turn' && (final.karts[0].x < -33 || final.karts[0].x > -15))
      throw new Error('Start approach did not reach the visible route boundary');
    if (
      process.argv.includes('--after') &&
      scenario === 'early-turn' &&
      final.karts[0].z > 100 &&
      !samples.some((state) => state.karts[0].windowJumpId !== null)
    )
      throw new Error('Window edge bypassed its jump trigger');
    if (
      process.argv.includes('--after') &&
      scenario === 'slow-window' &&
      (!penalty ||
        penalty.z < map.windowJumps[0].launchRect.z + map.windowJumps[0].takeoffOffset - 0.25 ||
        final.karts[0].windowJumpId !== null ||
        !metrics.warningSeen)
    )
      throw new Error('Window approach, warning or recovery failed');
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
