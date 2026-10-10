import type { Gate, MapConfig } from '../maps/shared/mapConfig';
import { centrelineOf, distanceAlongLap } from './routeProgress';
import { isInsideRect } from '../maps/shared/collision';

export interface KartProgress {
  lap: number;
  nextCheckpoint: number;
  checkpointsPassed: number;
  finished: boolean;
  finishTimeSeconds: number | null;
  previousX: number;
  previousZ: number;
  previousLevelId: string;
}

export function createProgress(x: number, z: number, levelId = 'ground'): KartProgress {
  return {
    lap: 0,
    nextCheckpoint: 1,
    checkpointsPassed: 0,
    finished: false,
    finishTimeSeconds: null,
    previousX: x,
    previousZ: z,
    previousLevelId: levelId,
  };
}

function orientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return Math.sign((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
}

export function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const first = orientation(ax, az, bx, bz, cx, cz);
  const second = orientation(ax, az, bx, bz, dx, dz);
  const third = orientation(cx, cz, dx, dz, ax, az);
  const fourth = orientation(cx, cz, dx, dz, bx, bz);
  return first !== second && third !== fourth;
}

function crossesGate(gate: Gate, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  if (!segmentsCross(fromX, fromZ, toX, toZ, gate.ax, gate.az, gate.bx, gate.bz)) return false;

  const movementX = toX - fromX;
  const movementZ = toZ - fromZ;
  const forwardX = gate.bz - gate.az;
  const forwardZ = gate.ax - gate.bx;
  return movementX * forwardX + movementZ * forwardZ > 0;
}

// Distance travelled along the centreline, counted across laps. The two guards keep
// the value monotone right at the start line, where a lap wraps from full to zero.
export function raceProgressScore(map: MapConfig, progress: KartProgress, x: number, z: number): number {
  const centreline = centrelineOf(map);
  const lapLength = centreline.totalLength;
  const previousNode = map.checkpoints[Math.max(0, progress.nextCheckpoint - 1)]?.routeNodeIndex;
  const nextNode = map.checkpoints[progress.nextCheckpoint]?.routeNodeIndex;
  const range = previousNode === undefined || nextNode === undefined ? undefined : { first: previousNode, last: nextNode };
  let alongLap = distanceAlongLap(centreline, x, z, map.routeNodes ? progress.previousLevelId : undefined, range);

  if (map.raceFormat === 'pointToPoint') return progress.finished ? lapLength : alongLap;

  const justPassedStartLine = progress.nextCheckpoint === 1;
  const approachingStartLine = progress.nextCheckpoint === 0;
  if (justPassedStartLine && alongLap > lapLength / 2) alongLap = 0;
  if (approachingStartLine && alongLap < lapLength / 2) alongLap = lapLength;

  return progress.lap * lapLength + alongLap;
}

export function updateProgress(
  map: MapConfig,
  lapCount: number,
  progress: KartProgress,
  x: number,
  z: number,
  raceTimeSeconds: number,
  levelId = 'ground',
): void {
  if (!progress.finished && isAtPositionalFinish(map, x, z, levelId)) {
    progress.lap = 1;
    progress.nextCheckpoint = map.checkpoints.length - 1;
    progress.checkpointsPassed += 1;
    progress.finished = true;
    progress.finishTimeSeconds = raceTimeSeconds;
  }
  updateCheckpointProgress(map, lapCount, progress, x, z, raceTimeSeconds, levelId);
  progress.previousX = x;
  progress.previousZ = z;
  progress.previousLevelId = levelId;
}

function isAtPositionalFinish(map: MapConfig, x: number, z: number, levelId: string): boolean {
  const finish = map.finishArea;
  return map.raceFormat === 'pointToPoint' && finish !== undefined && finish.levelId === levelId && isInsideRect(finish.rect, x, z);
}

function updateCheckpointProgress(
  map: MapConfig,
  lapCount: number,
  progress: KartProgress,
  x: number,
  z: number,
  raceTimeSeconds: number,
  levelId: string,
): void {
  if (map.raceFormat === 'pointToPoint' && map.finishArea && progress.nextCheckpoint === map.checkpoints.length - 1) return;
  const gate = map.checkpoints[progress.nextCheckpoint];
  if (gate && !progress.finished && crossedOnItsLevel(gate, progress, levelId, x, z)) advance(map, lapCount, progress, raceTimeSeconds);
}

/** A gate counts only when the kart drove through it on the gate's level, not past it on a floor above or below. */
function crossedOnItsLevel(gate: Gate, progress: KartProgress, levelId: string, x: number, z: number): boolean {
  const gateOnThisLevel = gate.levelId === undefined || gate.levelId === levelId;
  return gateOnThisLevel && progress.previousLevelId === levelId && crossesGate(gate, progress.previousX, progress.previousZ, x, z);
}

function advance(map: MapConfig, lapCount: number, progress: KartProgress, raceTimeSeconds: number): void {
  if (map.raceFormat === 'pointToPoint') {
    progress.checkpointsPassed += 1;
    if (progress.nextCheckpoint === map.checkpoints.length - 1) {
      progress.lap = 1;
      progress.finished = true;
      progress.finishTimeSeconds = raceTimeSeconds;
      return;
    }
    progress.nextCheckpoint += 1;
    return;
  }
  const isStartLine = progress.nextCheckpoint === 0;
  progress.nextCheckpoint = (progress.nextCheckpoint + 1) % map.checkpoints.length;
  progress.checkpointsPassed += 1;

  if (!isStartLine) return;

  progress.lap += 1;
  if (progress.lap < lapCount) return;

  progress.finished = true;
  progress.finishTimeSeconds = raceTimeSeconds;
}

export interface RankedKart {
  readonly kartIndex: number;
  readonly place: number;
}

function comesBefore(map: MapConfig, a: { progress: KartProgress; x: number; z: number }, b: { progress: KartProgress; x: number; z: number }): number {
  if (a.progress.finished || b.progress.finished) {
    if (!a.progress.finished) return 1;
    if (!b.progress.finished) return -1;
    return (a.progress.finishTimeSeconds ?? 0) - (b.progress.finishTimeSeconds ?? 0);
  }
  return raceProgressScore(map, b.progress, b.x, b.z) - raceProgressScore(map, a.progress, a.x, a.z);
}

export function rankKarts(map: MapConfig, karts: readonly { progress: KartProgress; x: number; z: number }[]): readonly RankedKart[] {
  return karts
    .map((kart, kartIndex) => ({ kart, kartIndex }))
    .sort((left, right) => comesBefore(map, left.kart, right.kart))
    .map((entry, order) => ({ kartIndex: entry.kartIndex, place: order + 1 }));
}

export function placeByKart(ranking: readonly RankedKart[]): readonly number[] {
  const places: number[] = [];
  for (const ranked of ranking) places[ranked.kartIndex] = ranked.place;
  return places;
}
