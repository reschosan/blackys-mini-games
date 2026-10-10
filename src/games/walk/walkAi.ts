import { GONE, SOLID, WARNING, type WalkFloor } from './walkFloor';
import type { WalkIntent } from './walkCat';

export interface WalkCatBody {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly grounded: boolean;
}

const STILL: WalkIntent = { move: { x: 0, y: 0 }, jump: false, paw: false };
const ARRIVED_METERS = 1.4;
const CHASE_RANGE_METERS = 8;
const PAW_REACH_METERS = 3;
/** An AI cat jumps up a step this close to its edge. */
const JUMP_FROM_EDGE_METERS = 2.2;
/** An AI cat starts to climb this long before the lava takes its level. */
const CLIMB_AHEAD_SECONDS = 9;
/** How far a paw sends a cat, in tiles (for judging where it would land). */
const PUSH_REACH_TILES = 0.8;

function towards(from: WalkCatBody, x: number, z: number): { x: number; y: number } {
  const dx = x - from.x;
  const dz = z - from.z;
  const length = Math.hypot(dx, dz);
  return length < ARRIVED_METERS ? { x: 0, y: 0 } : { x: dx / length, y: dz / length };
}

function nearest<T extends { x: number; z: number }>(from: WalkCatBody, candidates: readonly T[]): T | undefined {
  return [...candidates].sort((first, second) => Math.hypot(first.x - from.x, first.z - from.z) - Math.hypot(second.x - from.x, second.z - from.z))[0];
}

/** The step a cat stands on (or last stood on while it jumps). */
function levelOf(cat: WalkCatBody, floor: WalkFloor): number {
  return Math.max(Math.round(cat.y / floor.levelHeight), 0);
}

/** Runs to a tile and jumps when it is a step higher and the edge is close. */
function goTo(cat: WalkCatBody, floor: WalkFloor, target: number, level: number): WalkIntent {
  if (target < 0) return STILL;
  const centre = floor.centreOf(target);
  const edgeDistance = Math.hypot(centre.x - cat.x, centre.z - cat.z) - floor.tileSize / 2;
  const higher = floor.levels[target]! > level;
  return { move: towards(cat, centre.x, centre.z), jump: cat.grounded && higher && edgeDistance < JUMP_FROM_EDGE_METERS, paw: false };
}

/** Would a push from `cat` send `rival` somewhere bad: onto a glowing tile, down a step, or into a hole? Only then is it worth the paw. */
function pushWouldHurt(cat: WalkCatBody, rival: WalkCatBody, floor: WalkFloor): boolean {
  const dx = rival.x - cat.x;
  const dz = rival.z - cat.z;
  const length = Math.hypot(dx, dz) || 1;
  const landing = { x: rival.x + (dx / length) * floor.tileSize * PUSH_REACH_TILES, z: rival.z + (dz / length) * floor.tileSize * PUSH_REACH_TILES };
  const landingTile = floor.tileAt(landing.x, landing.z);
  return landingTile < 0 || floor.states[landingTile] !== SOLID || floor.heightAt(landing.x, landing.z) < rival.y - 0.5;
}

function nearestOf(cat: WalkCatBody, floor: WalkFloor, tiles: readonly number[]): number {
  const spots = tiles.map((tile) => ({ tile, ...floor.centreOf(tile) }));
  return nearest(cat, spots)?.tile ?? -1;
}

function floodComing(floor: WalkFloor, level: number): boolean {
  const seconds = floor.secondsToFlood();
  return seconds !== null && seconds < CLIMB_AHEAD_SECONDS && level < floor.nextFloodLevel();
}

/** Off a glowing or vanishing tile: first to a safe neighbour (no hole to cross), else to the nearest safe tile it can reach (at most a step up),
 *  above the coming lava if it can. */
function runToSafety(cat: WalkCatBody, floor: WalkFloor, tile: number, level: number): WalkIntent {
  const reachable = (tileLevel: number): boolean => tileLevel <= level + 1;
  const neighbour = nearestOf(cat, floor, tile < 0 ? [] : floor.safeNeighbours(tile).filter((other) => reachable(floor.levels[other]!)));
  if (neighbour >= 0) return goTo(cat, floor, neighbour, level);
  const aboveFlood = (tileLevel: number): boolean => reachable(tileLevel) && (!floodComing(floor, level) || tileLevel >= floor.nextFloodLevel());
  const target =
    [floor.nearestSafe(cat.x, cat.z, aboveFlood), floor.nearestSafe(cat.x, cat.z, reachable), floor.nearestSafe(cat.x, cat.z)].find((tile) => tile >= 0) ?? -1;
  return goTo(cat, floor, target, level);
}

/** What an AI cat does: it gets off a glowing or vanishing tile, climbs a step when the lava is about to rise, hits a cat that is close with its paw
 *  when the push would send it into danger, fetches a fish it can reach, or goes for such a cat in range on its own step. */
export function walkAiFrame(
  cat: WalkCatBody,
  floor: WalkFloor,
  others: readonly WalkCatBody[],
  fish: readonly { x: number; z: number; tile: number }[],
): WalkIntent {
  const tile = floor.tileAt(cat.x, cat.z);
  const state = tile < 0 ? GONE : floor.states[tile]!;
  const level = levelOf(cat, floor);
  if (state === WARNING || state === GONE) return runToSafety(cat, floor, tile, level);
  if (floodComing(floor, level))
    return goTo(
      cat,
      floor,
      floor.nearestSafe(cat.x, cat.z, (tileLevel) => tileLevel === level + 1),
      level,
    );
  const rival = nearest(
    cat,
    others.filter((other) => other !== cat && Math.abs(other.y - cat.y) < 1 && pushWouldHurt(cat, other, floor)),
  );
  const rivalDistance = rival ? Math.hypot(rival.x - cat.x, rival.z - cat.z) : Number.POSITIVE_INFINITY;
  if (rival && rivalDistance < PAW_REACH_METERS) return { move: towards(cat, rival.x, rival.z), jump: false, paw: true };
  const meal = nearest(
    cat,
    fish.filter((spot) => floor.levels[spot.tile]! <= level),
  );
  if (meal) return { move: towards(cat, meal.x, meal.z), jump: false, paw: false };
  if (rival && rivalDistance < CHASE_RANGE_METERS) return { move: towards(cat, rival.x, rival.z), jump: false, paw: false };
  return STILL;
}
