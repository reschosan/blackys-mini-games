import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadHouseConfiguration } from './houseConfiguration.mjs';

const map = await loadHouseConfiguration();
const collisionSource = fs.readFileSync('src/map/collision.ts', 'utf8');
const kartSource = fs.readFileSync('src/config/kart.ts', 'utf8');
const bankSource = fs.readFileSync('src/map/routeBanks.ts', 'utf8').replace(/^import .*\n/gm, '');
const bankCompiled = ts.transpileModule(`${kartSource}\n${collisionSource}\n${bankSource}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;
const { KART_WALL_COLLIDER_RADIUS, circleVsAabb, rectToAabb, distanceToRoute, routeBankLayout } = await import(
  `data:text/javascript;base64,${Buffer.from(bankCompiled).toString('base64')}`
);
const openingSource = ts
  .transpileModule(fs.readFileSync('src/map/views/house/modelOpenings.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  })
  .outputText.replace(/from 'three'/g, `from '${import.meta.resolve('three')}'`);
const { geometryWithOpenings } = await import(`data:text/javascript;base64,${Buffer.from(openingSource).toString('base64')}`);
const bytes = fs.readFileSync('public/models/house-interiors/house-interiors.glb');
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject),
);
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse((node) => {
  if (node.isMesh) meshes.push(node);
});
const scale = map.houseModelScale;
const panels = [];
const report = [];
const collisionCoverage = [];
const svgScale = 2;
const panelWidth = 480;
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');

function sectionSegments(mesh, height) {
  const position = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const count = indices?.count ?? position.count;
  const result = [];
  for (let index = 0; index < count; index += 3) {
    const points = [0, 1, 2].map((offset) =>
      new THREE.Vector3().fromBufferAttribute(position, indices ? indices.getX(index + offset) : index + offset).applyMatrix4(mesh.matrixWorld),
    );
    const intersections = [];
    for (let edge = 0; edge < 3; edge += 1) {
      const from = points[edge];
      const to = points[(edge + 1) % 3];
      if (from.y > height === to.y > height) continue;
      intersections.push(from.clone().lerp(to, (height - from.y) / (to.y - from.y)));
    }
    if (intersections.length === 2) result.push(intersections);
  }
  return result;
}

for (const [index, level] of map.levels.entries()) {
  const source = level.modelSource;
  const rawMeshes = meshes.filter((mesh) => {
    const centre = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    return centre.x >= source.minX && centre.x < source.maxX;
  });
  const openings = (level.modelCutouts ?? []).map(
    ({ rect, minHeight, maxHeight }) =>
      new THREE.Box3(
        new THREE.Vector3(
          source.centreX + (rect.x - rect.width / 2) / scale,
          source.floorY + (minHeight - level.floorHeight) / scale,
          (rect.z - rect.depth / 2) / scale,
        ),
        new THREE.Vector3(
          source.centreX + (rect.x + rect.width / 2) / scale,
          source.floorY + (maxHeight - level.floorHeight) / scale,
          (rect.z + rect.depth / 2) / scale,
        ),
      ),
  );
  const selected = rawMeshes.map((mesh) => {
    const opened = geometryWithOpenings(mesh, openings);
    if (!opened) return mesh;
    const clone = new THREE.Mesh(opened, mesh.material);
    clone.name = mesh.name;
    clone.updateMatrixWorld(true);
    return clone;
  });
  const project = (x, z) => ({ x: index * panelWidth + panelWidth / 2 + x * svgScale, y: 330 + z * svgScale });
  const rectangle = (rect, className) => {
    const point = project(rect.x - rect.width / 2, rect.z - rect.depth / 2);
    return `<rect class="${className}" x="${point.x}" y="${point.y}" width="${rect.width * svgScale}" height="${rect.depth * svgScale}"/>`;
  };
  const crossSection = selected.flatMap((mesh) => sectionSegments(mesh, source.floorY + 0.04).map(([a, b]) => [a, b, mesh.name]));
  const uncovered = new Map();
  const samples = selected.flatMap((mesh) =>
    [0.04, 0.1, 0.2].flatMap((height) => sectionSegments(mesh, source.floorY + height).map(([a, b]) => [a, b, mesh.name])),
  );
  const proxyBounds = level.collisionRects.map(rectToAabb);
  if (process.argv.includes('--proxy-audit')) {
    const nearSegment = (x, z, [a, b]) => {
      const ax = (a.x - source.centreX) * scale;
      const az = a.z * scale;
      const dx = (b.x - a.x) * scale;
      const dz = (b.z - a.z) * scale;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(x - ax - t * dx, z - az - t * dz);
    };
    const phantom = level.collisionRects.flatMap((rect, index) => {
      const points = [];
      for (let x = rect.x - rect.width / 2; x <= rect.x + rect.width / 2; x += 1) {
        for (let z = rect.z - rect.depth / 2; z <= rect.z + rect.depth / 2; z += 1) {
          if (distanceToRoute(map, level.id, x, z) > 10) continue;
          if (samples.some((segment) => nearSegment(x, z, segment) < 1)) continue;
          points.push({ x, z });
        }
      }
      return points.length ? [{ index, rect, count: points.length, example: points[0] }] : [];
    });
    fs.writeFileSync(`artifacts/house-proxy-audit-${level.id}.json`, JSON.stringify(phantom, null, 2));
  }
  for (const [a, b, mesh] of samples) {
    const steps = Math.max(1, Math.ceil(a.distanceTo(b) * scale));
    for (let sample = 0; sample <= steps; sample += 1) {
      const point = a.clone().lerp(b, sample / steps);
      const x = (point.x - source.centreX) * scale;
      const z = point.z * scale;
      if (proxyBounds.some((box) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, box))) continue;
      const reachable = distanceToRoute(map, level.id, x, z) < map.routeBanks.flatHalfWidth + map.routeBanks.width - KART_WALL_COLLIDER_RADIUS;
      if (reachable) uncovered.set(`${mesh},${Math.round(x)},${Math.round(z)}`, { mesh, x, z });
    }
  }
  collisionCoverage.push({ levelId: level.id, meshCount: selected.length, sectionHeights: [2.4, 6, 12], uncoveredReachablePoints: [...uncovered.values()] });
  const sections = crossSection
    .map(([a, b]) => {
      const from = project((a.x - source.centreX) * scale, a.z * scale);
      const to = project((b.x - source.centreX) * scale, b.z * scale);
      return `<line stroke="#ced6df" stroke-width="1" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
    })
    .join('');
  const roomLabels = map.namedRooms
    .filter((room) => room.levelId === level.id)
    .map((room) => {
      const point = project(room.rect.x, room.rect.z);
      return `${rectangle(room.rect, 'room')}<text class="label" x="${point.x}" y="${point.y}">${escape(room.name)}</text>`;
    })
    .join('');
  const pathNodes = map.routeNodes.filter((node) => node.levelId === level.id);
  const route = pathNodes
    .map((node) => {
      const point = project(node.x, node.z);
      return `${point.x},${point.y}`;
    })
    .join(' ');
  const gates = map.checkpoints
    .filter((gate) => gate.levelId === level.id)
    .map((gate) => {
      const from = project(gate.ax, gate.az);
      const to = project(gate.bx, gate.bz);
      return `<line class="gate" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
    })
    .join('');
  const stairs = map.stairTransitions
    .filter((stair) => stair.fromLevelId === level.id || stair.toLevelId === level.id)
    .map((stair) => rectangle(stair.rect, 'stair'))
    .join('');
  const windows = map.windowJumps
    .filter((jump) => jump.levelId === level.id)
    .map((jump) => `${rectangle(jump.launchRect, 'window')}${rectangle(jump.landingRect, 'landing')}`)
    .join('');
  const items = map.itemBoxes
    .filter((item) => item.levelId === level.id)
    .map((item) => {
      const point = project(item.x, item.z);
      return `<circle class="item" cx="${point.x}" cy="${point.y}" r="5"/>`;
    })
    .join('');
  const boundaries = routeBankLayout(map, level.id)
    .walls.map((rect) => rectangle(rect, 'collider'))
    .join('');
  panels.push(
    `<g><rect class="panel" x="${index * panelWidth}" y="0" width="480" height="650"/><text class="title" x="${index * panelWidth + 24}" y="35">${escape(level.name)} · Y=${level.floorHeight}</text>${level.driveableSurfaces.map((surface) => rectangle(surface, 'surface')).join('')}${roomLabels}${level.collisionRects.map((rect) => rectangle(rect, 'collider')).join('')}${boundaries}${sections}${stairs}${windows}<polyline class="route" points="${route}"/>${gates}${items}</g>`,
  );
  const obstructions = [];
  for (const [nodeIndex, node] of pathNodes.entries()) {
    const ray = new THREE.Raycaster(new THREE.Vector3(node.x / scale + source.centreX, 4, node.z / scale), new THREE.Vector3(0, -1, 0));
    const top = ray.intersectObjects(selected, false)[0];
    const height = top ? (top.point.y - source.floorY) * scale : null;
    if (height !== null && height > 4) obstructions.push({ nodeIndex, x: node.x, z: node.z, height, mesh: top?.object.name ?? null });
  }
  const blockedSegments = [];
  for (let nodeIndex = 1; nodeIndex < pathNodes.length; nodeIndex += 1) {
    const from = pathNodes[nodeIndex - 1];
    const to = pathNodes[nodeIndex];
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z));
    for (let tick = 0; tick <= steps; tick += 1) {
      const x = (from.x + ((to.x - from.x) * tick) / steps) / scale;
      const z = (from.z + ((to.z - from.z) * tick) / steps) / scale;
      if (level.modelCutouts.some(({ rect }) => Math.abs(x * scale - rect.x) < rect.width / 2 && Math.abs(z * scale - rect.z) < rect.depth / 2)) continue;
      const collision = crossSection.find(([a, b]) => {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((source.centreX + x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(source.centreX + x - a.x - dx * t, z - a.z - dz * t) < KART_WALL_COLLIDER_RADIUS / scale;
      });
      if (collision) {
        blockedSegments.push({ nodeIndex, x, z, mesh: collision[2] });
        break;
      }
    }
  }
  report.push({
    id: level.id,
    source,
    meshCount: selected.length,
    roomNames: map.namedRooms.filter((room) => room.levelId === level.id).map((room) => room.name),
    obstructions,
    blockedSegments,
  });
}
const outputPath = path.resolve('artifacts/house-interior-levels.svg');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="700" viewBox="0 0 1440 700"><style>.panel{fill:#151b23;stroke:#586575}.surface{fill:#293849;stroke:#728494}.room{fill:none;stroke:#435e75;stroke-dasharray:5 4}.collider{fill:#ad6754;fill-opacity:.85}.stair{fill:#8167bd;fill-opacity:.4;stroke:#c4b2ff}.window,.landing{fill:#387a95;fill-opacity:.35;stroke:#5cc7ed}.route{fill:none;stroke:#77e8ab;stroke-width:3;stroke-linejoin:round}.gate{stroke:#ffda72;stroke-width:3}.item{fill:#7db9ff;stroke:#fff}.title{fill:#fff;font:600 19px system-ui}.label{fill:#cad9e6;font:12px system-ui;text-anchor:middle}.legend{fill:#ddd;font:14px system-ui}</style>${panels.join('')}<text class="legend" x="24" y="680">Green: race route · Red: configured walls/furniture · Purple: stairs · Yellow: mandatory gates · Blue: items / window landing areas</text></svg>`;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, svg);
fs.writeFileSync('artifacts/house-geometry-report.json', JSON.stringify(report, null, 2));
fs.writeFileSync('artifacts/house-collision-coverage.json', JSON.stringify(collisionCoverage, null, 2));
console.log(JSON.stringify({ outputPath, levels: report }, null, 2));
if (report.some((level) => level.obstructions.length || level.blockedSegments.length)) throw new Error('House route intersects model geometry');
if (collisionCoverage.some((level) => level.uncoveredReachablePoints.length)) throw new Error('Reachable house geometry lacks collision coverage');
