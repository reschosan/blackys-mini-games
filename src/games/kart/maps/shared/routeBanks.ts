import type { Rect, RouteNode, MapConfig } from './mapConfig';
import { isInsideRect } from './collision';

export function distanceToRoute(map: MapConfig, levelId: string, x: number, z: number): number {
  const nodes = map.routeNodes ?? [];
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < nodes.length; index += 1) {
    const a = nodes[index - 1]!;
    const b = nodes[index]!;
    if (a.levelId !== levelId || b.levelId !== levelId) continue;
    distance = Math.min(distance, segmentDistanceSquared(a, b, x, z));
  }
  return Math.min(Math.sqrt(distance), startDistance(map, levelId, x, z));
}

function startDistance(map: MapConfig, levelId: string, x: number, z: number): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const start of map.startPositions) {
    if (start.levelId === levelId) distance = Math.min(distance, Math.hypot(x - start.x, z - start.z));
  }
  return distance;
}

function segmentDistanceSquared(a: RouteNode, b: RouteNode, x: number, z: number): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2;
}

export function routeBankHeight(map: MapConfig, levelId: string, x: number, z: number): number {
  const banks = map.routeBanks;
  if (!banks || isStairArea(map, levelId, x, z)) return 0;
  const distance = distanceToRoute(map, levelId, x, z);
  return Math.max(0, Math.min(1, (distance - banks.flatHalfWidth) / banks.width)) * banks.height;
}

export function routeBankTilt(map: MapConfig, levelId: string, x: number, z: number, yaw: number): { pitch: number; roll: number } {
  if (!map.routeBanks) return { pitch: 0, roll: 0 };
  const dx = Math.cos(yaw) * 0.25;
  const dz = Math.sin(yaw) * 0.25;
  const forward = routeBankHeight(map, levelId, x + dx, z + dz) - routeBankHeight(map, levelId, x - dx, z - dz);
  const side = routeBankHeight(map, levelId, x - dz, z + dx) - routeBankHeight(map, levelId, x + dz, z - dx);
  return { pitch: Math.atan2(forward, 0.5), roll: -Math.atan2(side, 0.5) };
}

function isStairArea(map: MapConfig, levelId: string, x: number, z: number): boolean {
  return map.stairTransitions?.some((stair) => (stair.fromLevelId === levelId || stair.toLevelId === levelId) && isInsideRect(stair.rect, x, z)) ?? false;
}

interface BankCell {
  readonly x: number;
  readonly z: number;
}
export interface BankLayout {
  readonly cells: readonly BankCell[];
  readonly walls: readonly Rect[];
  readonly edges: readonly Rect[];
  collisionRects?: readonly Rect[];
}
const layouts = new WeakMap<MapConfig, Map<string, BankLayout>>();

export function clearRouteBankLayout(map: MapConfig): void {
  layouts.delete(map);
}

export function reuseRouteBankLayout(source: MapConfig, target: MapConfig): void {
  const cached = layouts.get(source);
  if (cached) layouts.set(target, new Map(cached));
}

export function bankedCollisionRects(map: MapConfig, levelId: string, existing: readonly Rect[]): readonly Rect[] {
  const layout = routeBankLayout(map, levelId);
  return (layout.collisionRects ??= [...existing, ...layout.walls]);
}

export function routeBankLayout(map: MapConfig, levelId: string): BankLayout {
  let levels = layouts.get(map);
  if (!levels) {
    levels = new Map();
    layouts.set(map, levels);
  }
  let layout = levels.get(levelId);
  if (!layout) {
    layout = buildLayout(map, levelId);
    levels.set(levelId, layout);
  }
  return layout;
}

function buildLayout(map: MapConfig, levelId: string): BankLayout {
  const banks = map.routeBanks;
  const nodes = map.routeNodes?.filter((node) => node.levelId === levelId) ?? [];
  if (!banks || nodes.length === 0) return { cells: [], walls: [], edges: [] };
  const corridor = collectCorridorCells(map, levelId, nodes, banks);
  const dividers = map.routeDividers?.filter((divider) => divider.levelId === levelId).map((divider) => divider.rect) ?? [];
  return {
    cells: corridor.cells,
    walls: [...boundaryWalls(map, corridor.cells, corridor.occupied), ...dividers],
    edges: boundaryWalls(map, corridor.flatCells, corridor.flat, map.routeMarkings?.edgeWidth ?? 0.12),
  };
}

interface CorridorCells {
  readonly cells: BankCell[];
  readonly occupied: Set<string>;
  readonly flatCells: BankCell[];
  readonly flat: Set<string>;
}

function collectCorridorCells(
  map: MapConfig,
  levelId: string,
  nodes: readonly { readonly x: number; readonly z: number }[],
  banks: NonNullable<MapConfig['routeBanks']>,
): CorridorCells {
  const step = banks.gridSize;
  const radius = banks.flatHalfWidth + banks.width;
  const padding = radius + 8;
  const minX = Math.floor((Math.min(...nodes.map((node) => node.x)) - padding) / step);
  const maxX = Math.ceil((Math.max(...nodes.map((node) => node.x)) + padding) / step);
  const minZ = Math.floor((Math.min(...nodes.map((node) => node.z)) - padding) / step);
  const maxZ = Math.ceil((Math.max(...nodes.map((node) => node.z)) + padding) / step);
  const corridor: CorridorCells = { cells: [], occupied: new Set(), flatCells: [], flat: new Set() };
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) addCellIfInCorridor(corridor, map, levelId, banks, { x, z });
  }
  return corridor;
}

function addCellIfInCorridor(corridor: CorridorCells, map: MapConfig, levelId: string, banks: NonNullable<MapConfig['routeBanks']>, cell: BankCell): void {
  const centreX = (cell.x + 0.5) * banks.gridSize;
  const centreZ = (cell.z + 0.5) * banks.gridSize;
  if (!isCorridor(map, levelId, centreX, centreZ, banks.flatHalfWidth + banks.width)) return;
  corridor.occupied.add(`${cell.x},${cell.z}`);
  corridor.cells.push(cell);
  if (!isCorridor(map, levelId, centreX, centreZ, banks.flatHalfWidth)) return;
  corridor.flat.add(`${cell.x},${cell.z}`);
  corridor.flatCells.push(cell);
}

function isCorridor(map: MapConfig, levelId: string, x: number, z: number, radius: number): boolean {
  return distanceToRoute(map, levelId, x, z) <= radius || isStairArea(map, levelId, x, z);
}

function boundaryWalls(map: MapConfig, cells: readonly BankCell[], occupied: ReadonlySet<string>, thickness = map.routeBanks!.wallThickness): Rect[] {
  const { gridSize: step } = map.routeBanks!;
  const runs = new Map<string, number[]>();
  for (const cell of cells) {
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      if (occupied.has(`${cell.x + dx},${cell.z + dz}`)) continue;
      const key = boundaryKey(cell, dx, dz);
      const values = runs.get(key) ?? [];
      values.push(dx !== 0 ? cell.z : cell.x);
      runs.set(key, values);
    }
  }
  return [...runs].flatMap(([key, values]) => mergeWallRun(key, values, step, thickness));
}

function boundaryKey(cell: BankCell, dx: number, dz: number): string {
  if (dx !== 0) return `x,${cell.x + Math.max(0, dx)}`;
  return `z,${cell.z + Math.max(0, dz)}`;
}

function mergeWallRun(key: string, values: number[], step: number, thickness: number): Rect[] {
  const [axis, coordinate] = key.split(',');
  values.sort((a, b) => a - b);
  const walls: Rect[] = [];
  let start = values[0]!;
  let end = start;
  const append = () => {
    const fixed = Number(coordinate) * step;
    const centre = ((start + end + 1) * step) / 2;
    const length = (end - start + 1) * step + thickness;
    walls.push(axis === 'x' ? { x: fixed, z: centre, width: thickness, depth: length } : { x: centre, z: fixed, width: length, depth: thickness });
  };
  for (const value of values.slice(1)) {
    if (value > end + 1) {
      append();
      start = value;
    }
    end = value;
  }
  append();
  return walls;
}
