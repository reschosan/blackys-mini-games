import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const url = process.env.CAT_KART_URL ?? 'http://127.0.0.1:5173';
const output = process.env.CAT_KART_MARKER_OUTPUT ?? '.dev-screenshots/house-feedback-markers';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const names = await page.evaluate(async () => {
    const source = await (await fetch('/src/map/views/mapView.ts')).text();
    const threeUrl = source.match(/from "([^"]*three\.js[^\"]*)"/)?.[1];
    if (!threeUrl) throw new Error('Vite Three.js module was not resolved');
    const THREE = await import(threeUrl);
    const { FAMILY_HOUSE: map } = await import('/src/maps/familyHouse/map.ts');
    const { createMapView } = await import('/src/map/views/mapView.ts');
    const { showRouteGuidance } = await import('/src/map/views/house/routeMarkings.ts');
    const { showHouseLevel } = await import('/src/map/views/house/houseInteriorView.ts');
    const { KartView } = await import('/src/kart/views/kartView.ts');
    const { ItemBoxView } = await import('/src/items/views/itemBoxView.ts');
    const { houseCameraClearance, setHouseOccludedCameraPosition } = await import('/src/camera/houseOcclusion.ts');
    const { kartElevationAt } = await import('/src/map/surface.ts');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;width:100%;height:100%';
    document.body.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1280, 800);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x24242a);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(12, 30, 8);
    scene.add(light);
    const view = createMapView(map);
    scene.add(view);
    view.add(new ItemBoxView(map).object);
    const kart = new KartView(0xff6655);
    scene.add(kart.object);
    const camera = new THREE.PerspectiveCamera(55, 1280 / 800, 0.1, 500);
    while (!view.userData.houseModelLoaded) await new Promise(requestAnimationFrame);
    const poses = map.windowJumps.map((jump) => ({
      name: jump.id,
      levelId: jump.levelId,
      x: jump.launchRect.x - Math.cos(jump.launchYaw) * 8,
      z: jump.launchRect.z - Math.sin(jump.launchYaw) * 8,
      yaw: jump.launchYaw,
      checkpoint: jump.levelId === 'ground' ? 1 : jump.optional ? 6 : 7,
    }));
    poses.push({ name: 'hobby-door-wall', levelId: 'first', x: -6, z: -37, yaw: Math.PI / 2, checkpoint: 5 });
    poses.push({ name: 'hobby-wall-return', levelId: 'first', x: -6, z: -55, yaw: -Math.PI / 2, checkpoint: 5 });
    poses.push({ name: 'closed-hobby-branch', levelId: 'first', x: -6, z: -33, yaw: Math.PI / 2, checkpoint: 5 });
    poses.push({ name: 'first-wall-depth', levelId: 'first', x: 30, z: -85.8, yaw: -Math.PI / 2, checkpoint: 5 });
    poses.push({ name: 'wall-contact-camera', levelId: 'first', x: -27, z: -85.8, yaw: 0, checkpoint: 5 });
    poses.push({ name: 'living-door-no-jump', levelId: 'ground', x: -27, z: 90, yaw: Math.PI / 2, checkpoint: 1 });
    poses.push({ name: 'kitchen-door-no-jump', levelId: 'first', x: 63.6, z: 90, yaw: Math.PI / 2, checkpoint: 7 });
    poses.push({ name: 'kitchen-item-clearance', levelId: 'first', x: -3, z: 47, yaw: Math.PI / 2, checkpoint: 6 });
    poses.push({ name: 'bedroom-cut', levelId: 'second', x: -14.4, z: 12, yaw: Math.PI / 2, checkpoint: 11 });
    poses.push({ name: 'finish', levelId: 'second', x: -26, z: 84, yaw: Math.PI, checkpoint: 13 });
    poses.push({ name: 'stair-walls', levelId: 'ground', x: -66, z: -20, yaw: -Math.PI / 2, checkpoint: 4, stairTransitionId: map.stairTransitions[0].name });
    window.qaMarkerView = {
      renderer,
      scene,
      view,
      kart,
      camera,
      poses,
      map,
      showHouseLevel,
      showRouteGuidance,
      houseCameraClearance,
      setHouseOccludedCameraPosition,
      kartElevationAt,
      THREE,
    };
    return poses.map((pose) => pose.name);
  });
  for (const name of names) {
    await page.evaluate((name) => {
      const q = window.qaMarkerView;
      const pose = q.poses.find((pose) => pose.name === name);
      const floor = q.kartElevationAt(q.map, { ...pose, stairTransitionId: pose.stairTransitionId ?? null });
      q.showHouseLevel(q.view, pose.levelId);
      q.showRouteGuidance(q.view, q.map, pose.levelId, pose.checkpoint, pose);
      q.kart.setTransform(pose.x, pose.z, pose.yaw, floor);
      q.camera.position.set(pose.x - Math.cos(pose.yaw) * 16.9, floor + 7, pose.z - Math.sin(pose.yaw) * 16.9);
      q.camera.lookAt(pose.x, floor + 2, pose.z);
      const origin = new q.THREE.Vector3(pose.x, floor + 2, pose.z);
      const direction = q.camera.position.clone().sub(origin);
      const distance = direction.length();
      const clearance = q.houseCameraClearance(q.map, pose.levelId, origin, direction.normalize(), distance);
      if (clearance < distance) {
        q.setHouseOccludedCameraPosition(q.map, pose.levelId, origin, direction, clearance, q.camera.position);
        q.camera.lookAt(origin);
      }
      if (name === 'wall-contact-camera') {
        const offset = q.camera.position.clone().sub(origin);
        if (Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) > Math.PI / 6) throw new Error('Wall-contact camera became top-down');
      }
      q.renderer.render(q.scene, q.camera);
    }, name);
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ mode: 'stationary-render-check-not-a-race', views: names, errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ views: names, errors }));
} finally {
  await browser.close();
}
