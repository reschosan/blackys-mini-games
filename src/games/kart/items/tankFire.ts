import type { ItemConfig } from '../../../shared/config/items';
import { KART_COLLIDER_RADIUS } from '../../../shared/config/kart';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import type { Rng } from '../../../shared/core/rng';
import type { KartState } from '../kart/kartState';
import type { KartProgress } from '../race/raceState';
import { resolveBodyVsRects } from '../maps/shared/collision';
import { collidableRects, followStairs, kartWorldHeightAt } from '../maps/shared/surface';
import type { MapConfig } from '../maps/shared/mapConfig';
import { applyStunHit } from './itemHit';

const SHELL_RADIUS = 0.35;
const SHELL_HIT_RADIUS = KART_COLLIDER_RADIUS + SHELL_RADIUS;

interface TankShell {
  x: number;
  z: number;
  heading: number;
  ageSeconds: number;
  readonly ownerIndex: number;
  readonly targetIndex: number;
  levelId: string;
  elevation: number;
}

export interface TankExplosion {
  readonly x: number;
  readonly z: number;
  readonly levelId: string;
  readonly elevation: number;
  ageSeconds: number;
}

interface TankShooter {
  cooldownSeconds: number;
  holdoffSeconds: number;
  previousPlace: number;
}

/** Everything the tanks of a race have in flight, plus their per-tank reload state (by participant index). */
export interface TankFire {
  readonly shells: TankShell[];
  readonly explosions: TankExplosion[];
  readonly shooters: (TankShooter | undefined)[];
}

export interface TankFireParticipant {
  readonly state: KartState;
  readonly progress: Pick<KartProgress, 'finished'>;
  readonly loadout?: Pick<KartLoadout, 'kartType'>;
}

export interface TankFireEvents {
  readonly fired?: (ownerIndex: number) => void;
  readonly detonated?: (explosion: TankExplosion) => void;
}

export function createTankFire(): TankFire {
  return { shells: [], explosions: [], shooters: [] };
}

export function resetTankFire(fire: TankFire): void {
  fire.shells.length = 0;
  fire.explosions.length = 0;
  fire.shooters.length = 0;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function isTank(participant: TankFireParticipant): boolean {
  return participant.loadout?.kartType === 'tank';
}

function weightedPick(candidates: readonly number[], weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = rng.next() * total;
  let cumulative = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    cumulative += weights[index]!;
    if (roll < cumulative) return candidates[index]!;
  }
  return candidates[candidates.length - 1]!;
}

function targetCandidates(participants: readonly TankFireParticipant[], places: readonly number[], ownerIndex: number): number[] {
  const owner = participants[ownerIndex]!;
  const ownPlace = places[ownerIndex] ?? 0;
  return participants.flatMap((participant, index) => {
    const ahead = (places[index] ?? Infinity) < ownPlace;
    const reachable = !participant.progress.finished && participant.state.levelId === owner.state.levelId && participant.state.windowJumpId === null;
    return ahead && reachable ? [index] : [];
  });
}

/** Chance weights of the karts ahead: from the config table, or uniform for places it does not list. */
function targetWeights(items: ItemConfig, ownPlace: number, places: readonly number[], candidates: readonly number[]): number[] {
  const byPlace = items.tank.targetWeightsByPlace[ownPlace];
  const uniform = candidates.map(() => 1);
  if (!byPlace) return uniform;
  const weights = candidates.map((index) => byPlace[(places[index] ?? 1) - 1] ?? 0);
  return weights.some((weight) => weight > 0) ? weights : uniform;
}

function pickTarget(items: ItemConfig, participants: readonly TankFireParticipant[], places: readonly number[], ownerIndex: number, rng: Rng): number | null {
  const candidates = targetCandidates(participants, places, ownerIndex);
  if (candidates.length === 0) return null;
  return weightedPick(candidates, targetWeights(items, places[ownerIndex] ?? 0, places, candidates), rng);
}

function spawnShell(map: MapConfig, owner: KartState, ownerIndex: number, targetIndex: number): TankShell {
  const spawnOffset = KART_COLLIDER_RADIUS + SHELL_RADIUS;
  return {
    x: owner.x + Math.cos(owner.yaw) * spawnOffset,
    z: owner.z + Math.sin(owner.yaw) * spawnOffset,
    heading: owner.yaw,
    ageSeconds: 0,
    ownerIndex,
    targetIndex,
    levelId: owner.levelId,
    elevation: kartWorldHeightAt(map, owner),
  };
}

function updateShooter(shooter: TankShooter, items: ItemConfig, place: number, stepSeconds: number): void {
  if (shooter.previousPlace > 0 && place > shooter.previousPlace) shooter.holdoffSeconds = items.tank.overtakenHoldoffSeconds;
  shooter.previousPlace = place;
  shooter.cooldownSeconds = Math.max(shooter.cooldownSeconds - stepSeconds, 0);
  shooter.holdoffSeconds = Math.max(shooter.holdoffSeconds - stepSeconds, 0);
}

function stepShooter(
  fire: TankFire,
  items: ItemConfig,
  map: MapConfig,
  participants: readonly TankFireParticipant[],
  places: readonly number[],
  index: number,
  rng: Rng,
  stepSeconds: number,
  events: TankFireEvents,
): void {
  const shooter = (fire.shooters[index] ??= { cooldownSeconds: items.tank.shotIntervalSeconds, holdoffSeconds: 0, previousPlace: places[index] ?? 0 });
  const place = places[index] ?? 0;
  updateShooter(shooter, items, place, stepSeconds);
  const participant = participants[index]!;
  const reloading = shooter.cooldownSeconds > 0 || shooter.holdoffSeconds > 0;
  const nobodyAhead = place <= 1;
  if (reloading || nobodyAhead || participant.progress.finished) return;
  const target = pickTarget(items, participants, places, index, rng);
  if (target === null) return;
  fire.shells.push(spawnShell(map, participant.state, index, target));
  shooter.cooldownSeconds = items.tank.shotIntervalSeconds;
  events.fired?.(index);
}

function turnTowardTarget(shell: TankShell, target: KartState, items: ItemConfig, stepSeconds: number): void {
  const desired = Math.atan2(target.z - shell.z, target.x - shell.x);
  const maxTurn = items.tank.shellTurnRateRadiansPerSecond * stepSeconds;
  shell.heading += Math.max(-maxTurn, Math.min(maxTurn, normalizeAngle(desired - shell.heading)));
}

function shellHitsWall(shell: TankShell, map: MapConfig, velocityX: number, velocityZ: number): boolean {
  const body = { x: shell.x, z: shell.z, velocityX, velocityZ };
  return resolveBodyVsRects(body, SHELL_RADIUS, collidableRects(map, shell.levelId), 1);
}

function shellTouchesKart(shell: TankShell, map: MapConfig, karts: readonly KartState[]): boolean {
  return karts.some((kart, index) => {
    if (index === shell.ownerIndex || kart.levelId !== shell.levelId) return false;
    const dx = kart.x - shell.x;
    const dz = kart.z - shell.z;
    const dy = kartWorldHeightAt(map, kart) - shell.elevation;
    return dx * dx + dy * dy + dz * dz <= SHELL_HIT_RADIUS * SHELL_HIT_RADIUS;
  });
}

function detonate(fire: TankFire, items: ItemConfig, map: MapConfig, shell: TankShell, karts: readonly KartState[], events: TankFireEvents): void {
  const radius = items.tank.explosionRadiusMeters;
  for (const kart of karts) {
    if (kart.levelId !== shell.levelId) continue;
    const dx = kart.x - shell.x;
    const dz = kart.z - shell.z;
    const dy = kartWorldHeightAt(map, kart) - shell.elevation;
    if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
    const side = dx * -Math.sin(kart.yaw) + dz * Math.cos(kart.yaw) >= 0 ? 1 : -1;
    applyStunHit(kart, items.tank, side, items.leaderStunBonusSeconds);
  }
  const explosion: TankExplosion = { x: shell.x, z: shell.z, levelId: shell.levelId, elevation: shell.elevation, ageSeconds: 0 };
  fire.explosions.push(explosion);
  events.detonated?.(explosion);
}

/** Moves one shell; returns whether it is spent (it detonated). */
function stepShell(
  fire: TankFire,
  items: ItemConfig,
  map: MapConfig,
  shell: TankShell,
  karts: readonly KartState[],
  stepSeconds: number,
  events: TankFireEvents,
): boolean {
  shell.ageSeconds += stepSeconds;
  const target = karts[shell.targetIndex];
  if (target) turnTowardTarget(shell, target, items, stepSeconds);
  const speed = items.tank.shellSpeedMetersPerSecond;
  const velocityX = Math.cos(shell.heading) * speed;
  const velocityZ = Math.sin(shell.heading) * speed;
  shell.x += velocityX * stepSeconds;
  shell.z += velocityZ * stepSeconds;
  followStairs(map, shell, velocityX, velocityZ);
  const spent = shell.ageSeconds >= items.tank.shellLifetimeSeconds || shellHitsWall(shell, map, velocityX, velocityZ) || shellTouchesKart(shell, map, karts);
  if (spent) detonate(fire, items, map, shell, karts, events);
  return spent;
}

function stepShells(fire: TankFire, items: ItemConfig, map: MapConfig, karts: readonly KartState[], stepSeconds: number, events: TankFireEvents): void {
  for (let index = fire.shells.length - 1; index >= 0; index -= 1) {
    if (stepShell(fire, items, map, fire.shells[index]!, karts, stepSeconds, events)) fire.shells.splice(index, 1);
  }
}

function stepExplosions(fire: TankFire, items: ItemConfig, stepSeconds: number): void {
  for (let index = fire.explosions.length - 1; index >= 0; index -= 1) {
    const explosion = fire.explosions[index]!;
    explosion.ageSeconds += stepSeconds;
    if (explosion.ageSeconds >= items.tank.explosionVisibleSeconds) fire.explosions.splice(index, 1);
  }
}

/** Reloads every tank, fires its automatic shell, and flies/explodes the shells in the air. Seeded-`rng`
 *  driven (target choice) and `stepSeconds`-driven, so it stays covered by the determinism tests. */
export function stepTankFire(
  fire: TankFire,
  items: ItemConfig,
  map: MapConfig,
  participants: readonly TankFireParticipant[],
  places: readonly number[],
  rng: Rng,
  stepSeconds: number,
  events: TankFireEvents = {},
): void {
  participants.forEach((participant, index) => {
    if (isTank(participant)) stepShooter(fire, items, map, participants, places, index, rng, stepSeconds, events);
  });
  stepShells(
    fire,
    items,
    map,
    participants.map((participant) => participant.state),
    stepSeconds,
    events,
  );
  stepExplosions(fire, items, stepSeconds);
}
