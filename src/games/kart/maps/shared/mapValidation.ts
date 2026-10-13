import { KART_COLLIDER_RADIUS } from '../../../../shared/config/kart';
import type { Gate, Rect, MapConfig } from './mapConfig';
import { isInsideRect } from './collision';
import { isOnRouteSurface } from './surface';

export interface MapValidationError {
  readonly rule: string;
  readonly message: string;
}

const KART_DIAMETER = KART_COLLIDER_RADIUS * 2;
const MIN_GATE_LENGTH = 0.1;
const GATE_SAMPLE_COUNT = 8;

export function validateMap(map: MapConfig): readonly MapValidationError[] {
  return [
    ...validateRouteWidth(map),
    ...validateStartPositions(map),
    ...validateWaypoints(map),
    ...validateCheckpoints(map),
    ...validateItemBoxes(map),
    ...validateObstacles(map),
  ];
}

function validateRouteWidth(map: MapConfig): MapValidationError[] {
  if (map.driveableWidth >= KART_DIAMETER) return [];
  return [error('routeWidth', `${map.name}: route width must be at least one kart diameter (${KART_DIAMETER.toFixed(2)}m).`)];
}

function validateStartPositions(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  map.startPositions.forEach((start, index) => {
    if (!isOnRouteSurface(map, start.x, start.z)) {
      errors.push(error('startOnMap', `${map.name}: start position ${index + 1} must sit on the driveable route.`));
    }
    if (isInsideAnyObstacle(map, start.x, start.z)) {
      errors.push(error('startObstacle', `${map.name}: start position ${index + 1} must not sit inside furniture.`));
    }
  });

  errors.push(...validateStartOverlaps(map));
  return errors;
}

function validateStartOverlaps(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  for (let left = 0; left < map.startPositions.length; left += 1) {
    for (let right = left + 1; right < map.startPositions.length; right += 1) {
      const first = map.startPositions[left];
      const second = map.startPositions[right];
      if (!first || !second) continue;
      if (distance(first.x, first.z, second.x, second.z) < KART_DIAMETER) {
        errors.push(error('startOverlap', `${map.name}: start positions ${left + 1} and ${right + 1} overlap.`));
      }
    }
  }
  return errors;
}

function validateWaypoints(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  if (map.waypoints.length < 3) {
    errors.push(error('waypointCount', `${map.name}: at least three waypoints are required.`));
  }

  map.waypoints.forEach((waypoint, index) => {
    if (!isOnRouteSurface(map, waypoint.x, waypoint.z)) {
      errors.push(error('waypointOnRoute', `${map.name}: waypoint ${index + 1} must sit on the driveable route.`));
    }
  });

  return errors;
}

function validateCheckpoints(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  if (map.checkpoints.length < 3) {
    errors.push(error('checkpointCount', `${map.name}: at least three checkpoints are required.`));
  }

  map.checkpoints.forEach((checkpoint, index) => {
    if (gateLength(checkpoint) < MIN_GATE_LENGTH) {
      errors.push(error('checkpointLength', `${map.name}: checkpoint ${index + 1} must have a visible length.`));
      return;
    }
    if (!gateCrossesRoute(map, checkpoint)) {
      errors.push(error('checkpointCrossesRoute', `${map.name}: checkpoint ${index + 1} must cross the route.`));
    }
  });

  return errors;
}

function validateItemBoxes(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  const maxDistanceFromLine = map.driveableWidth / 2 + KART_COLLIDER_RADIUS;

  map.itemBoxes.forEach((spawn, index) => {
    if (!isOnRouteSurface(map, spawn.x, spawn.z)) {
      errors.push(error('itemOnRoute', `${map.name}: item box ${index + 1} must sit on the driveable route.`));
    }
    if (isInsideAnyObstacle(map, spawn.x, spawn.z)) {
      errors.push(error('itemObstacle', `${map.name}: item box ${index + 1} must not sit inside furniture.`));
    }
    if (distanceToWaypointLoop(map, spawn.x, spawn.z) > maxDistanceFromLine) {
      errors.push(error('itemReachable', `${map.name}: item box ${index + 1} must be reachable from the waypoint line.`));
    }
  });

  return errors;
}

function validateObstacles(map: MapConfig): MapValidationError[] {
  const errors: MapValidationError[] = [];
  for (const obstacle of map.obstacles) {
    if (rectTouchesRoute(map, obstacle.rect)) {
      errors.push(error('obstacleIntrusion', `${map.name}: obstacle "${obstacle.name}" must not intrude into the driveable route.`));
    }
  }
  return errors;
}

function error(rule: string, message: string): MapValidationError {
  return { rule, message };
}

function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function gateLength(gate: Gate): number {
  return distance(gate.ax, gate.az, gate.bx, gate.bz);
}

function gateCrossesRoute(map: MapConfig, gate: Gate): boolean {
  for (let index = 0; index <= GATE_SAMPLE_COUNT; index += 1) {
    const t = index / GATE_SAMPLE_COUNT;
    const x = gate.ax + (gate.bx - gate.ax) * t;
    const z = gate.az + (gate.bz - gate.az) * t;
    if (isOnRouteSurface(map, x, z)) return true;
  }
  return false;
}

function isInsideAnyObstacle(map: MapConfig, x: number, z: number): boolean {
  return map.obstacles.some((obstacle) => isInsideRect(obstacle.rect, x, z));
}

function rectTouchesRoute(map: MapConfig, rect: Rect): boolean {
  return map.driveableSurfaces.some((surface) => rectsOverlap(rect, surface));
}

function rectsOverlap(first: Rect, second: Rect): boolean {
  return Math.abs(first.x - second.x) < (first.width + second.width) / 2 && Math.abs(first.z - second.z) < (first.depth + second.depth) / 2;
}

function distanceToWaypointLoop(map: MapConfig, x: number, z: number): number {
  if (map.waypoints.length === 0) return Number.POSITIVE_INFINITY;
  if (map.waypoints.length === 1) {
    const only = map.waypoints[0];
    return only ? distance(x, z, only.x, only.z) : Number.POSITIVE_INFINITY;
  }

  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < map.waypoints.length; index += 1) {
    const from = map.waypoints[index];
    const to = map.waypoints[(index + 1) % map.waypoints.length];
    if (!from || !to) continue;
    nearest = Math.min(nearest, distanceToSegment(x, z, from.x, from.z, to.x, to.z));
  }
  return nearest;
}

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const segmentX = bx - ax;
  const segmentZ = bz - az;
  const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (segmentLengthSquared === 0) return distance(px, pz, ax, az);

  const t = Math.min(Math.max(((px - ax) * segmentX + (pz - az) * segmentZ) / segmentLengthSquared, 0), 1);
  return distance(px, pz, ax + segmentX * t, az + segmentZ * t);
}
