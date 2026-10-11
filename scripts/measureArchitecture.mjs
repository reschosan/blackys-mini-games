import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const urls = process.argv.slice(2);
const mapIndex = Number(process.env.CAT_KART_MAP_INDEX ?? 1);
if (urls.length !== 2 || !Number.isInteger(mapIndex) || mapIndex < 0)
  throw new Error('Usage: CAT_KART_MAP_INDEX=1 node scripts/measureArchitecture.mjs <baseline-url> <current-url>');
const output = '.dev-screenshots/architecture-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const reports = [];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

try {
  for (const url of urls) {
    const runs = [];
    for (let run = 0; run < 3; run += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          Date.now = () => 123456789;
          window.__architectureFrames = [];
          let previous;
          function sample(now) {
            const state = window.__game?.getState();
            if (previous !== undefined && state?.phase === 'racing' && state.raceTimeSeconds >= 2 && state.raceTimeSeconds <= 8) {
              window.__architectureFrames.push(now - previous);
            }
            previous = now;
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        const started = await page.evaluate((index) => window.__game.startEnduranceRace(index, false), mapIndex);
        if (!started) throw new Error(`Could not start endurance race for map ${mapIndex}`);
        await page.waitForFunction(() => window.__game.getState().houseModelLoaded);
        await page.waitForFunction(() => window.__game.getState().raceTimeSeconds >= 8.1, undefined, { timeout: 30000 });
        const result = await page.evaluate(() => {
          const gl = document.querySelector('canvas').getContext('webgl2');
          const extension = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            frames: window.__architectureFrames,
            state: window.__game.getState(),
            gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
          };
        });
        const frames = result.frames;
        const profiler = await context.newCDPSession(page);
        await profiler.send('HeapProfiler.collectGarbage');
        await profiler.send('Performance.enable');
        const { metrics } = await profiler.send('Performance.getMetrics');
        const retainedHeapBytes = metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? null;
        await profiler.detach();
        runs.push({
          errors,
          gpu: result.gpu,
          sampledFrames: frames.length,
          medianMs: percentile(frames, 0.5),
          p95Ms: percentile(frames, 0.95),
          p99Ms: percentile(frames, 0.99),
          worstMs: Math.max(...frames),
          framesOver25Ms: frames.filter((frame) => frame > 25).length,
          heapBytes: result.state.runtime.heapBytes,
          retainedHeapBytes,
          rendering: result.state.rendering,
        });
        if (errors.length || frames.length < 60) throw new Error(`Invalid performance sample: ${JSON.stringify(runs.at(-1))}`);
      } finally {
        await context.close();
      }
    }
    reports.push({ url, mapIndex, runs });
  }
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
