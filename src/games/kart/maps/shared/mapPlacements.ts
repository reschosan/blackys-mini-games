import { DEFAULT_DRIVING } from '../../../../shared/config/driving';
import { ITEM_TYPES } from '../../../../shared/config/items';
import { DEFAULT_PLACEMENT_BOOST, DEFAULT_PLACEMENT_JUMP, type MapPlacement, type PlacementItem } from './mapSettings';
import type { ItemBoxSpawn, Rect, SurfaceZone, MapConfig, WindowJump } from './mapConfig';
import { circleVsAabb, rectToAabb } from './collision';

interface Segment {
  readonly x: number;
  readonly z: number;
  readonly dx: number;
  readonly dz: number;
  readonly length: number;
  readonly start: number;
}

interface PlacementPose {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly levelId: string;
  readonly along: number;
  readonly segment: Segment;
}

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Placement: ${label} must be positive and finite.`);
}

function levelIdFor(map: MapConfig, level: number): string {
  if (!Number.isInteger(level) || level < 0) throw new Error('Placement: level must be a non-negative integer.');
  if (!map.levels?.length && level === 0) return 'ground';
  const found = map.levels?.find((candidate) => candidate.placementLevel === level);
  if (!found) throw new Error(`${map.name}: placement level ${level} does not exist.`);
  return found.id;
}

function segmentsFor(map: MapConfig, levelId: string): Segment[] {
  const pairs = routePairs(map);
  const segments: Segment[] = [];
  let start = 0;
  for (const [a, b] of pairs) {
    if (a.levelId !== levelId || b.levelId !== levelId) continue;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (!length) continue;
    const next = { x: a.x, z: a.z, dx: (b.x - a.x) / length, dz: (b.z - a.z) / length, length, start };
    appendSegment(segments, next);
    start += length;
  }
  return segments;
}

function routePairs(map: MapConfig) {
  const points = map.routeNodes ?? map.waypoints.map((point) => ({ ...point, levelId: 'ground' }));
  const pairs = points.slice(1).map((point, index) => [points[index]!, point] as const);
  if (!map.routeNodes && map.raceFormat !== 'pointToPoint' && points.length) pairs.push([points[points.length - 1]!, points[0]!] as const);
  return pairs;
}

function appendSegment(segments: Segment[], next: Segment): void {
  const previous = segments.at(-1);
  if (previous && continuesStraight(previous, next)) segments[segments.length - 1] = { ...previous, length: previous.length + next.length };
  else segments.push(next);
}

function continuesStraight(a: Segment, b: Segment): boolean {
  return Math.abs(a.dx - b.dx) < 1e-8 && Math.abs(a.dz - b.dz) < 1e-8 && Math.hypot(a.x + a.dx * a.length - b.x, a.z + a.dz * a.length - b.z) < 1e-8;
}

export function placementRouteLength(map: MapConfig, level: number): number {
  return segmentsFor(map, levelIdFor(map, level)).reduce((sum, segment) => sum + segment.length, 0);
}

export function placementPoseAt(map: MapConfig, level: number, meter: number, lateralMeters = 0): PlacementPose {
  const levelId = levelIdFor(map, level);
  const segments = segmentsFor(map, levelId);
  const segment = segments.find((candidate) => meter < candidate.start + candidate.length - 1e-8) ?? segments.at(-1);
  const length = segments.reduce((sum, candidate) => sum + candidate.length, 0);
  if (!segment || !Number.isFinite(meter) || meter < 0 || meter > length + 1e-8) {
    throw new Error(`${map.name}: level ${level}, meter ${meter} is outside 0–${length.toFixed(2)} m.`);
  }
  if (!Number.isFinite(lateralMeters)) throw new Error('Placement: lateralMeters must be finite.');
  const along = meter - segment.start;
  return {
    x: segment.x + segment.dx * along - segment.dz * lateralMeters,
    z: segment.z + segment.dz * along + segment.dx * lateralMeters,
    yaw: Math.atan2(segment.dz, segment.dx),
    levelId,
    along,
    segment,
  };
}

function checkItem(item: PlacementItem): void {
  if (item !== 'random' && !ITEM_TYPES.includes(item)) throw new Error(`Placement: unknown item ${item}.`);
}

function boxAt(pose: PlacementPose, item: PlacementItem, lateral = 0): ItemBoxSpawn {
  checkItem(item);
  return { x: pose.x - Math.sin(pose.yaw) * lateral, z: pose.z + Math.cos(pose.yaw) * lateral, levelId: pose.levelId, ...(item === 'random' ? {} : { item }) };
}

function ensureClear(map: MapConfig, pose: { x: number; z: number; levelId: string }, radius: number): void {
  const level = map.levels?.find((candidate) => candidate.id === pose.levelId);
  const architecture = level?.collisionRects ?? [...map.walls, ...map.obstacles.map((obstacle) => obstacle.rect)];
  const dividers = map.routeDividers?.filter((divider) => divider.levelId === pose.levelId).map((divider) => divider.rect) ?? [];
  const rects = [...architecture, ...dividers];
  if (rects.some((rect) => circleVsAabb(pose.x, pose.z, radius, rectToAabb(rect)))) {
    throw new Error(`${map.name}: placement on ${pose.levelId} intersects a wall or furniture.`);
  }
}

function itemRow(map: MapConfig, placement: Extract<MapPlacement, { type: 'itemBoxes' }>, pose: PlacementPose): ItemBoxSpawn[] {
  if (!placement.items.length) throw new Error('Placement: an item row needs at least one item.');
  const spacing = placement.spacingMeters ?? DEFAULT_PLACEMENT_JUMP.boxSpacingMeters;
  requirePositive(spacing, 'spacingMeters');
  return placement.items.map((item, index) => {
    const lateral = (index - (placement.items.length - 1) / 2) * spacing;
    ensureWithinRoute(map, (placement.lateralMeters ?? 0) + lateral, 0.9);
    const box = boxAt(pose, item, lateral);
    ensureClear(map, { ...box, levelId: pose.levelId }, 0.9);
    return box;
  });
}

function ensureWithinRoute(map: MapConfig, lateral: number, halfWidth: number): void {
  const available = map.routeBanks?.flatHalfWidth ?? map.driveableWidth / 2;
  if (Math.abs(lateral) + halfWidth > available) throw new Error(`${map.name}: placement does not fit within the flat route width.`);
}

function orientedRect(pose: PlacementPose, along: number, length: number, width: number): Rect {
  const dx = Math.cos(pose.yaw),
    dz = Math.sin(pose.yaw);
  return {
    x: pose.x + dx * along,
    z: pose.z + dz * along,
    width: Math.abs(dx) * length + Math.abs(dz) * width,
    depth: Math.abs(dz) * length + Math.abs(dx) * width,
  };
}

function createJump(map: MapConfig, placement: Extract<MapPlacement, { type: 'jump' | 'itemJump' }>, pose: PlacementPose): WindowJump {
  const settings = { ...DEFAULT_PLACEMENT_JUMP, ...placement.jump };
  Object.entries(settings).forEach(([key, value]) => requirePositive(value, key));
  ensureWithinRoute(map, placement.lateralMeters ?? 0, settings.width / 2);
  if (settings.referenceSpeed < settings.minimumSpeed) throw new Error('Placement: referenceSpeed must reach minimumSpeed.');
  const flightLength = DEFAULT_DRIVING.maxSpeed * DEFAULT_DRIVING.boostSpeedFactor * settings.durationSeconds;
  const end = flightLength + settings.landingMargin;
  if (pose.along < settings.rampLength || pose.along + end > pose.segment.length) {
    throw new Error(`${map.name}: jump ${placement.id} needs a straight from ${settings.rampLength} m before to ${end.toFixed(2)} m after takeoff.`);
  }
  for (let along = -settings.rampLength; along <= end; along += 0.5) {
    const sample = orientedRect(pose, along, 0.1, settings.width);
    ensureClear(map, { ...sample, levelId: pose.levelId }, settings.width / 2);
  }
  const recovery = orientedRect(pose, settings.referenceSpeed * settings.durationSeconds, 0.1, 0.1);
  const { minimumSpeed, durationSeconds, peakHeight, airControlPerSecond, penaltySeconds, rampLength, rampHeight } = settings;
  return {
    id: placement.id,
    name: placement.type === 'itemJump' ? 'Item-Sprung' : 'Sprung',
    optional: true,
    hasItem: placement.type === 'itemJump',
    levelId: pose.levelId,
    landingLevelId: pose.levelId,
    launchRect: orientedRect(pose, 0, 2, settings.width),
    landingRect: orientedRect(pose, end / 2, end, settings.landingWidth),
    minimumSpeed,
    durationSeconds,
    peakHeight,
    airControlPerSecond,
    penaltySeconds,
    rampLength,
    rampHeight,
    recovery: { x: recovery.x, z: recovery.z, yaw: pose.yaw, levelId: pose.levelId },
    launchYaw: pose.yaw,
    takeoffOffset: 0,
  };
}

function jumpBox(placement: Extract<MapPlacement, { type: 'itemJump' }>, pose: PlacementPose, jump: WindowJump): ItemBoxSpawn {
  const speed = placement.jump?.referenceSpeed ?? DEFAULT_PLACEMENT_JUMP.referenceSpeed;
  const centre = orientedRect(pose, (speed * jump.durationSeconds) / 2, 0.1, 0.1);
  return {
    ...boxAt({ ...pose, x: centre.x, z: centre.z }, placement.item),
    heightOffset: jump.peakHeight + (jump.rampHeight ?? 0) / 2,
    jumpId: jump.id,
    boostSeconds: DEFAULT_PLACEMENT_JUMP.boostSeconds,
  };
}

function createBoostField(map: MapConfig, placement: Extract<MapPlacement, { type: 'boostField' }>, pose: PlacementPose) {
  const width = placement.width ?? DEFAULT_PLACEMENT_BOOST.width;
  const length = placement.length ?? DEFAULT_PLACEMENT_BOOST.length;
  const durationSeconds = placement.durationSeconds ?? DEFAULT_PLACEMENT_BOOST.durationSeconds;
  requirePositive(width, 'boost width');
  requirePositive(length, 'boost length');
  requirePositive(durationSeconds, 'boost duration');
  ensureWithinRoute(map, placement.lateralMeters ?? 0, width / 2);
  if (pose.along < length / 2 || pose.along + length / 2 > pose.segment.length) {
    throw new Error(`Placement: boost field ${placement.id} must fit on a straight segment (${pose.along}/${pose.segment.length}).`);
  }
  for (let offset = -length / 2; offset <= length / 2; offset += 0.5) {
    const rect = orientedRect(pose, offset, 0.1, width);
    ensureClear(map, { ...rect, levelId: pose.levelId }, width / 2);
  }
  return { id: placement.id, rect: orientedRect(pose, 0, length, width), levelId: pose.levelId, durationSeconds, yaw: pose.yaw };
}

function createSurfaceZone(map: MapConfig, placement: Extract<MapPlacement, { type: 'surfaceZone' }>, pose: PlacementPose): SurfaceZone {
  const routeWidth = (map.routeBanks?.flatHalfWidth ?? map.driveableWidth / 2) * 2;
  const width = placement.width ?? routeWidth;
  requirePositive(width, 'surface zone width');
  requirePositive(placement.length, 'surface zone length');
  ensureWithinRoute(map, placement.lateralMeters ?? 0, width / 2);
  if (pose.along < placement.length / 2 || pose.along + placement.length / 2 > pose.segment.length) {
    throw new Error(`Placement: surface zone at meter ${placement.meter} must fit on a straight segment (${pose.along}/${pose.segment.length}).`);
  }
  return { kind: placement.kind, rect: orientedRect(pose, 0, placement.length, width), levelId: pose.levelId };
}

interface ResolvedPlacements {
  readonly itemBoxes: ItemBoxSpawn[];
  readonly windowJumps: WindowJump[];
  readonly boostFields: NonNullable<MapConfig['boostFields']>[number][];
  readonly surfaceZones: SurfaceZone[];
}

function resolvePlacement(map: MapConfig, placement: MapPlacement, resolved: ResolvedPlacements): void {
  const { itemBoxes, windowJumps, boostFields, surfaceZones } = resolved;
  const pose = placementPoseAt(map, placement.level, placement.meter, placement.lateralMeters);
  if (placement.type === 'itemBoxes') {
    itemBoxes.push(...itemRow(map, placement, pose));
    return;
  }
  if (placement.type === 'boostField') {
    boostFields.push(createBoostField(map, placement, pose));
    return;
  }
  if (placement.type === 'surfaceZone') {
    surfaceZones.push(createSurfaceZone(map, placement, pose));
    return;
  }
  const jump = createJump(map, placement, pose);
  windowJumps.push(jump);
  if (placement.type === 'itemJump') itemBoxes.push(jumpBox(placement, pose, jump));
}

export function withMapPlacements(map: Omit<MapConfig, 'itemBoxes'>, placements: readonly MapPlacement[]): MapConfig {
  const base: MapConfig = { ...map, itemBoxes: [] };
  const resolved: ResolvedPlacements = { itemBoxes: [], windowJumps: [], boostFields: [], surfaceZones: [] };
  const ids = new Set<string>();
  for (const placement of placements) {
    if ('id' in placement) {
      if (!placement.id || ids.has(placement.id)) throw new Error(`Placement: duplicate or empty jump id ${placement.id}.`);
      ids.add(placement.id);
    }
    resolvePlacement(base, placement, resolved);
  }
  return { ...map, ...resolved };
}
