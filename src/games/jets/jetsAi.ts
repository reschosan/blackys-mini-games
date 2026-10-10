import type { ModeTuning } from '../../shared/config/modes';
import { ITEM_BOOST, ITEM_MISSILE, ITEM_NONE, ITEM_SHIELD, type JetIntent } from './jetsTypes';

export interface JetBody {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
}

export interface AiPilot extends JetBody {
  readonly item: number;
}

const FIRE_ANGLE_RADIANS = 0.15;
const FIRE_RANGE_METERS = 55;
const MISSILE_RANGE_METERS = 110;
const MISSILE_ANGLE_RADIANS = 0.6;
const SHIELD_DANGER_METERS = 55;
const PICKUP_DETOUR_METERS = 80;
const ENEMY_CLOSE_METERS = 45;
const STEER_GAIN = 3;
const CLIMB_GAIN = 0.2;
const HEIGHT_PER_METER_TOLERANCE = 0.2;

const distanceBetween = (from: JetBody, to: { x: number; y: number; z: number }): number => Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

function nearestTo<T extends { x: number; y: number; z: number }>(from: JetBody, candidates: readonly T[], rank = 0): T | undefined {
  const sorted = [...candidates].sort((first, second) => distanceBetween(from, first) - distanceBetween(from, second));
  return sorted[rank % Math.max(sorted.length, 1)];
}

function useItemNow(pilot: AiPilot, enemy: JetBody | undefined, distance: number, angle: number): boolean {
  if (pilot.item === ITEM_BOOST) return true;
  if (pilot.item === ITEM_SHIELD) return enemy !== undefined && distance < SHIELD_DANGER_METERS;
  return pilot.item === ITEM_MISSILE && enemy !== undefined && distance < MISSILE_RANGE_METERS && Math.abs(angle) < MISSILE_ANGLE_RADIANS;
}

type Point = { x: number; y: number; z: number };

/** Where the shot has to go to meet an enemy that keeps flying. */
function leadPoint(enemy: JetBody, distance: number, tuning: ModeTuning['jets']): Point {
  const flight = distance / tuning.bulletSpeed;
  return { x: enemy.x + Math.cos(enemy.heading) * tuning.speed * flight, y: enemy.y, z: enemy.z + Math.sin(enemy.heading) * tuning.speed * flight };
}

/** What an AI pilot does: it fetches an item box when no enemy is close, otherwise it flies at the nearest enemy, matches its height, leads the shot and fires when it points at it.
 *  `aimError` is how far off it aims right now, so that it does not hit every time; `rank` picks the nth nearest enemy, so that the pilots do not all go for the same one. */
export function jetAiFrame(
  pilot: AiPilot,
  enemies: readonly JetBody[],
  pickups: readonly Point[],
  tuning: ModeTuning['jets'],
  aimError = 0,
  rank = 0,
): JetIntent {
  const enemy = nearestTo(pilot, enemies, rank);
  const box = pilot.item === ITEM_NONE ? nearestTo(pilot, pickups) : undefined;
  const enemyDistance = enemy ? distanceBetween(pilot, enemy) : Number.POSITIVE_INFINITY;
  const goesForBox = box !== undefined && distanceBetween(pilot, box) < PICKUP_DETOUR_METERS && enemyDistance > ENEMY_CLOSE_METERS;
  const aim = goesForBox ? box : enemy && leadPoint(enemy, enemyDistance, tuning);
  if (!aim) return { steer: 0, climb: 0, fire: false, useItem: false };
  const wanted = Math.atan2(aim.z - pilot.z, aim.x - pilot.x) + aimError;
  const angle = Math.atan2(Math.sin(wanted - pilot.heading), Math.cos(wanted - pilot.heading));
  const height = aim.y - pilot.y;
  const fire =
    !goesForBox &&
    Math.abs(angle) < FIRE_ANGLE_RADIANS &&
    enemyDistance < FIRE_RANGE_METERS &&
    Math.abs(height) < enemyDistance * HEIGHT_PER_METER_TOLERANCE + 2;
  return { steer: clampUnit(angle * STEER_GAIN), climb: clampUnit(height * CLIMB_GAIN), fire, useItem: useItemNow(pilot, enemy, enemyDistance, angle) };
}
