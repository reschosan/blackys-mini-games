import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { loadHouseConfiguration } from './houseConfiguration.mjs';

const map = await loadHouseConfiguration();
const playerCount = process.argv.includes('--single') ? 1 : 2;
const feedback = process.argv.includes('--feedback');
const banks = process.argv.includes('--banks');
const wallFeedback = process.argv.includes('--wall-feedback');
const bedroomCut = process.argv.includes('--bedroom-cut');
const gardenCut = process.argv.includes('--garden-cut');
const profileStart = process.argv.includes('--profile-start');
const output =
  process.env.CAT_KART_QA_OUTPUT ??
  `.dev-screenshots/controller-${profileStart ? 'profile-start' : banks ? 'banks' : feedback ? 'feedback' : playerCount === 1 ? 'single' : 'split'}`;
await mkdir(output, { recursive: true });
if (process.argv.includes('--verify-report')) {
  const report = JSON.parse(await readFile(`${output}/house-controller-report.json`, 'utf8'));
  const firstFinish = report.samples.find((state) => state.karts[0].finished)?.karts[0];
  const cornerCut = firstFinish?.levelId === 'second' && firstFinish.z < 76;
  if (
    report.errors.length ||
    !report.wallChecks.kitchenChecked ||
    !cornerCut ||
    report.final.karts.some((kart) => !kart.finished) ||
    report.visitedRooms.some((rooms) => rooms.length !== map.namedRooms.length)
  )
    throw new Error('Recorded house feedback checks failed');
  const verification = {
    errors: report.errors,
    visitedRooms: report.visitedRooms,
    firstFinish,
    kitchenChecked: true,
    finalCornerCut: cornerCut,
    metrics: report.metrics,
    finalTimeSeconds: report.final.raceTimeSeconds,
  };
  await writeFile(`${output}/feedback-verification.json`, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification));
  process.exit(0);
}
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.addInitScript((count) => {
  window.qaPads = Array.from({ length: count }, () => ({ connected: false, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => false) }));
  Object.defineProperty(navigator, 'getGamepads', {
    value: () =>
      window.qaPads.map((pad, index) =>
        pad.connected
          ? {
              index,
              id: `QA Virtual Controller ${index}`,
              mapping: 'standard',
              connected: true,
              timestamp: performance.now(),
              axes: [...pad.axes],
              buttons: pad.buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
            }
          : null,
      ),
  });
}, playerCount);

async function tap(index, button, axis = 0) {
  await page.evaluate(
    ({ index, button, axis }) => {
      const pad = window.qaPads[index];
      pad.connected = true;
      pad.axes[0] = axis;
      if (button !== null) pad.buttons[button] = true;
    },
    { index, button, axis },
  );
  await page.waitForTimeout(160);
  await page.evaluate((index) => {
    const pad = window.qaPads[index];
    pad.axes[0] = 0;
    pad.buttons.fill(false);
  }, index);
  await page.waitForTimeout(160);
}

try {
  const profiler = profileStart ? await page.context().newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
  }
  await page.addInitScript(() => {
    window.qaFrameIntervals = [];
    let previous = 0;
    const record = (now) => {
      if (previous) window.qaFrameIntervals.push({ milliseconds: now - previous, phase: window.__game?.getState().phase ?? 'loading' });
      previous = now;
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.goto(process.env.CAT_KART_URL ?? 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__game?.getState);
  await page.waitForLoadState('networkidle');
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return extension ? { renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) } : null;
  });
  await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
  for (let index = 0; index < playerCount; index += 1) await tap(index, 0);
  for (let index = 0; index < playerCount; index += 1) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const label = await page.locator(`[data-player-index="${index}"] [data-row-id][active]`).textContent();
      if (label === 'Bereit') break;
      await tap(index, 13);
    }
    await tap(index, 0);
  }
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible' });
  for (let index = 0; index < playerCount; index += 1) {
    await tap(index, null, 1);
    await tap(index, null, 1);
    await tap(index, 0);
  }
  await page.waitForFunction(() => window.__game.getState().phase === 'racing');
  await page.waitForFunction(() => window.__game.getState().houseModelLoaded);
  await page.waitForTimeout(3600);
  await page.evaluate(
    ({ map, feedback, banks, wallFeedback, bedroomCut, gardenCut }) => {
      const indices = window.qaPads.map(() => 1);
      let bankVisited = false;
      let kitchenChecked = false;
      let finalCornerCut = false;
      window.qaWallChecks = { kitchenChecked: false, finalCornerCut: false, bedroomCut: false };
      const normalized = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
      const drive = () => {
        const state = window.__game.getState();
        if (state.phase !== 'racing') return;
        state.karts.forEach((kart, index) => {
          const pad = window.qaPads[index];
          if (!pad || kart.finished) return;
          const nodes = map.routeNodes;
          while (
            indices[index] < nodes.length - 1 &&
            Math.hypot(nodes[indices[index]].x - kart.x, nodes[indices[index]].z - kart.z) < map.routeAi.reachDistance
          )
            indices[index] += 1;
          if (bedroomCut && index === 0 && indices[index] === 56) {
            indices[index] = 57;
            window.qaWallChecks.bedroomCut = true;
          }
          const target = { ...nodes[indices[index]] };
          if (gardenCut && index === 0 && indices[index] === 3) {
            target.z = 110;
            if (Math.hypot(target.x - kart.x, target.z - kart.z) < 1) indices[index] = 4;
          }
          const previous = nodes[Math.max(0, indices[index] - 1)];
          const next = nodes[indices[index] + 1];
          const kitchenDetour = wallFeedback && index === 0 && indices[index] === 34 && !kitchenChecked;
          if (kitchenDetour) {
            target.x = 15;
            target.z = 78;
            if (Math.hypot(target.x - kart.x, target.z - kart.z) < 1) {
              kitchenChecked = true;
              window.qaWallChecks.kitchenChecked = true;
            }
          }
          const cuttingFinalCorner = wallFeedback && index === 0 && indices[index] === 59 && !finalCornerCut;
          if (cuttingFinalCorner) {
            target.x = -32;
            target.z = 75;
            if (Math.hypot(target.x - kart.x, target.z - kart.z) < 1) {
              finalCornerCut = true;
              window.qaWallChecks.finalCornerCut = true;
              indices[index] += 1;
            }
          }
          const climbBank = banks && index === 0 && indices[index] === 14 && !bankVisited;
          if (climbBank) {
            target.x = 40;
            target.z = -85.8 + map.routeBanks.flatHalfWidth + map.routeBanks.width / 2;
            if (Math.hypot(target.x - kart.x, target.z - kart.z) < 0.6) bankVisited = true;
          }
          if (feedback && !climbBank && !kitchenDetour && !cuttingFinalCorner && !kart.windowJumpId && !kart.stairTransitionId) {
            const direction = Math.atan2(target.z - previous.z, target.x - previous.x);
            const offset = index === 0 ? -0.5 : 0.5;
            target.x -= Math.sin(direction) * offset;
            target.z += Math.cos(direction) * offset;
          }
          const distance = Math.hypot(target.x - kart.x, target.z - kart.z);
          const angle = normalized(Math.atan2(target.z - kart.z, target.x - kart.x) - kart.yaw);
          const top = 22 * map.routeAi.speedFactor * (wallFeedback && index === 1 ? 0.8 : 1);
          const turn = next ? normalized(Math.atan2(next.z - target.z, next.x - target.x) - Math.atan2(target.z - previous.z, target.x - previous.x)) : 0;
          const corner = Math.max(map.routeAi.cornerSpeed, top * Math.cos(turn));
          let cap =
            Math.min(top, Math.sqrt(corner * corner + 30 * Math.max(0, distance - map.routeAi.reachDistance - map.routeAi.brakingMargin))) *
            Math.max(0.23, Math.cos(angle));
          if (feedback && index === 0 && indices[index] <= 3) cap = Math.min(cap, 4);
          if (climbBank) cap = Math.min(cap, 3);
          if (kitchenDetour) cap = Math.min(cap, 3);
          if (cuttingFinalCorner) cap = Math.min(cap, 5);
          const steer = kart.windowJumpId ? 0 : Math.max(-1, Math.min(1, angle * 2));
          pad.axes[0] = steer === 0 ? 0 : Math.sign(steer) * (0.15 + Math.abs(steer) * 0.85);
          pad.buttons[1] = kart.speed > cap + 1 && kart.speed > 3;
          pad.buttons[0] = !pad.buttons[1] && kart.speed < cap;
        });
        requestAnimationFrame(drive);
      };
      drive();
    },
    { map, feedback, banks, wallFeedback, bedroomCut, gardenCut },
  );
  const samples = [];
  const photos = new Set();
  for (let tick = 0; tick < 4200; tick += 1) {
    const state = await page.evaluate(() => window.__game.getState());
    samples.push(state);
    const kart = state.karts[0];
    for (const jump of map.windowJumps) {
      const dx = kart.x - jump.launchRect.x;
      const dz = kart.z - jump.launchRect.z;
      const yaw = jump.launchYaw ?? 0;
      const ahead = -(dx * Math.cos(yaw) + dz * Math.sin(yaw));
      if (
        kart.levelId === jump.levelId &&
        ahead > 1 &&
        ahead < 8 &&
        Math.cos(kart.yaw - yaw) > 0.95 &&
        Math.abs(-dx * Math.sin(yaw) + dz * Math.cos(yaw)) < 3 &&
        !photos.has(`approach-${jump.id}`)
      ) {
        photos.add(`approach-${jump.id}`);
        await page.screenshot({ path: `${output}/approach-${jump.id}.png` });
      }
    }
    if (tick % 300 === 0) await writeFile(`${output}/latest-state.json`, JSON.stringify(state));
    const room = map.namedRooms.find(
      (room) => room.levelId === kart.levelId && Math.abs(kart.x - room.rect.x) < room.rect.width / 2 && Math.abs(kart.z - room.rect.z) < room.rect.depth / 2,
    );
    const climbing = banks && kart.levelId === 'ground' && !kart.windowJumpId && !kart.stairTransitionId && kart.elevation > 0.3;
    const key = climbing ? 'bank-climb' : (kart.windowJumpId ?? kart.stairTransitionId ?? (room ? `${room.levelId}-${map.namedRooms.indexOf(room)}` : null));
    if (wallFeedback && kart.levelId === 'first' && Math.hypot(kart.x - 15, kart.z - 78) < 2 && !photos.has('kitchen-clearance')) {
      photos.add('kitchen-clearance');
      await page.screenshot({ path: `${output}/kitchen-clearance.png` });
    }
    if (key && !photos.has(key)) {
      photos.add(key);
      await page.screenshot({ path: `${output}/controller-${photos.size}.png` });
    }
    if (state.phase === 'results') break;
    if (profileStart && state.raceTimeSeconds > 30) break;
    await page.waitForTimeout(100);
  }
  const final = samples.at(-1);
  const visitedRooms = Array.from({ length: playerCount }, (_, index) =>
    map.namedRooms
      .filter((room) =>
        samples.some((state) => {
          const kart = state.karts[index];
          return kart.levelId === room.levelId && Math.abs(kart.x - room.rect.x) < room.rect.width / 2 && Math.abs(kart.z - room.rect.z) < room.rect.depth / 2;
        }),
      )
      .map((room) => room.name),
  );
  const frameRates = samples
    .filter((state) => state.phase === 'racing')
    .map((state) => state.runtime.fps)
    .sort((a, b) => a - b);
  const metrics = { medianFps: frameRates[Math.floor(frameRates.length / 2)], fifthPercentileFps: frameRates[Math.floor(frameRates.length * 0.05)] };
  await page.screenshot({ path: `${output}/controller-finish.png` });
  const intervals = await page.evaluate(() => window.qaFrameIntervals);
  await writeFile(`${output}/frame-intervals.json`, JSON.stringify(intervals));
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    await writeFile(`${output}/start.cpuprofile`, JSON.stringify(profile));
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ errors, metrics, final, worstFrame: Math.max(...intervals.map((frame) => frame.milliseconds)) }));
  } else {
    const wallChecks = await page.evaluate(() => window.qaWallChecks);
    const firstFinish = samples.find((state) => state.karts[0].finished)?.karts[0];
    if (wallFeedback && firstFinish?.levelId === 'second' && firstFinish.z < 76) wallChecks.finalCornerCut = true;
    await writeFile(
      `${output}/house-controller-report.json`,
      JSON.stringify(
        { playerCount, feedback, banks, wallFeedback, bedroomCut, wallChecks, gpu, errors, metrics, visitedRooms, photos: [...photos], final, samples },
        null,
        2,
      ),
    );
    if (bedroomCut && !wallChecks.bedroomCut) throw new Error('Bedroom corner cut was not completed');
    if (wallFeedback && (!wallChecks.kitchenChecked || !wallChecks.finalCornerCut)) throw new Error('Wall feedback detours were not completed');
    if (banks && !photos.has('bank-climb')) throw new Error('Controller did not climb the bank');
    if (
      errors.length ||
      final?.phase !== 'results' ||
      final.karts.some((kart) => !kart.finished) ||
      visitedRooms.some((rooms) => rooms.length !== map.namedRooms.length)
    )
      throw new Error(`Controller race failed: ${JSON.stringify(final)}`);
    console.log(JSON.stringify({ playerCount, gpu, errors, metrics, visitedRooms, photos: [...photos], final }, null, 2));
  }
} catch (error) {
  await page.screenshot({ path: `${output}/controller-error.png` });
  console.log(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
