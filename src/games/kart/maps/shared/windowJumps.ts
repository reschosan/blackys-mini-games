import type { MapConfig, WindowJump } from './mapConfig';
import { forwardSpeedOf, type KartState } from '../../kart/kartState';
import type { InputFrame } from '../../../../shared/input/actions';
import { isInsideRect } from './collision';
import { distanceToRoute } from './routeBanks';
import { KART_COLLIDER_RADIUS } from '../../../../shared/config/kart';
import { t } from '../../../../shared/i18n';

function jumpById(map: MapConfig, id: string | null): WindowJump | undefined {
  return map.windowJumps?.find((jump) => jump.id === id);
}

function clearJump(kart: KartState): void {
  kart.windowJumpId = null;
  kart.windowJumpElapsedSeconds = 0;
}

function stopKart(kart: KartState): void {
  kart.velocityX = 0;
  kart.velocityZ = 0;
  kart.driftDirection = 0;
  kart.driftCharge = 0;
  kart.driftStage = 0;
  kart.boostSeconds = 0;
}

function recover(kart: KartState, jump: WindowJump): void {
  kart.x = jump.recovery.x;
  kart.z = jump.recovery.z;
  kart.yaw = jump.recovery.yaw;
  kart.levelId = jump.recovery.levelId ?? jump.levelId;
  kart.stairTransitionId = null;
  stopKart(kart);
  clearJump(kart);
}

function startPenalty(kart: KartState, jump: WindowJump): void {
  kart.penaltySecondsLeft = jump.penaltySeconds;
  stopKart(kart);
}

function advanceJump(map: MapConfig, kart: KartState, jump: WindowJump, input: InputFrame, stepSeconds: number): void {
  kart.windowJumpElapsedSeconds = Math.min(kart.windowJumpElapsedSeconds + stepSeconds, jump.durationSeconds);
  kart.x += kart.velocityX * stepSeconds - Math.sin(kart.yaw) * input.steer * jump.airControlPerSecond * stepSeconds;
  kart.z += kart.velocityZ * stepSeconds + Math.cos(kart.yaw) * input.steer * jump.airControlPerSecond * stepSeconds;
  if (kart.windowJumpElapsedSeconds < jump.durationSeconds) return;

  if (isInsideRect(jump.landingRect, kart.x, kart.z) && isInsideLandingCorridor(map, kart, jump)) {
    kart.levelId = jump.landingLevelId;
    clearJump(kart);
    return;
  }
  startPenalty(kart, jump);
}

function isInsideLandingCorridor(map: MapConfig, kart: KartState, jump: WindowJump): boolean {
  const banks = map.routeBanks;
  if (!banks) return true;
  const clearance = banks.flatHalfWidth + banks.width - KART_COLLIDER_RADIUS - banks.wallThickness - banks.gridSize / 2;
  return distanceToRoute(map, jump.landingLevelId, kart.x, kart.z) <= clearance;
}

/** Advances a window jump/penalty and returns true while normal driving must be skipped. */
export function updateWindowJump(map: MapConfig, kart: KartState, input: InputFrame, stepSeconds: number): boolean {
  const activeJump = jumpById(map, kart.windowJumpId);
  if (kart.penaltySecondsLeft > 0) {
    kart.penaltySecondsLeft = Math.max(kart.penaltySecondsLeft - stepSeconds, 0);
    if (kart.penaltySecondsLeft === 0 && activeJump) recover(kart, activeJump);
    return true;
  }
  if (activeJump) {
    kart.boostSeconds = Math.max(kart.boostSeconds - stepSeconds, 0);
    advanceJump(map, kart, activeJump, input, stepSeconds);
    return true;
  }

  const jump = map.windowJumps?.find(
    (candidate) => candidate.levelId === kart.levelId && isInsideRect(candidate.launchRect, kart.x, kart.z) && isLeavingWindow(candidate, kart),
  );
  if (!jump) {
    kart.lastWindowJumpId = null;
    return false;
  }
  return tryStartJump(kart, jump);
}

function tryStartJump(kart: KartState, jump: WindowJump): boolean {
  if (jump.id === kart.lastWindowJumpId) return false;
  if (!hasReachedTakeoff(jump, kart.x, kart.z)) return false;
  if (jump.optional && forwardSpeedOf(kart) < jump.minimumSpeed) return false;
  kart.windowJumpId = jump.id;
  kart.lastWindowJumpId = jump.id;
  kart.windowJumpElapsedSeconds = 0;
  if (forwardSpeedOf(kart) < jump.minimumSpeed) startPenalty(kart, jump);
  return true;
}

function isLeavingWindow(jump: WindowJump, kart: KartState): boolean {
  if (jump.launchYaw === undefined) return true;
  const outwardSpeed = kart.velocityX * Math.cos(jump.launchYaw) + kart.velocityZ * Math.sin(jump.launchYaw);
  return outwardSpeed > 0 || (outwardSpeed === 0 && Math.cos(kart.yaw - jump.launchYaw) > 0.5);
}

function hasReachedTakeoff(jump: WindowJump, x: number, z: number): boolean {
  const yaw = jump.launchYaw ?? 0;
  return (x - jump.launchRect.x) * Math.cos(yaw) + (z - jump.launchRect.z) * Math.sin(yaw) >= (jump.takeoffOffset ?? Number.NEGATIVE_INFINITY) - 1e-6;
}

export function windowJumpHint(map: MapConfig, kart: KartState): string | null {
  if (kart.penaltySecondsLeft > 0) return kart.windowJumpElapsedSeconds === 0 ? t().race.takeoffTooSlow : t().race.landingMissed;
  const jump = map.windowJumps?.find((candidate) => candidate.levelId === kart.levelId && isInsideRect(candidate.launchRect, kart.x, kart.z));
  if (!jump || kart.windowJumpId !== null) return null;
  const tooSlow = forwardSpeedOf(kart) < jump.minimumSpeed;
  return jump.optional ? optionalRampHint(jump, tooSlow) : windowHint(tooSlow);
}

function windowHint(tooSlow: boolean): string {
  return tooSlow ? t().race.windowMoreRunUp : t().race.windowStraight;
}

function optionalRampHint(jump: WindowJump, tooSlow: boolean): string {
  if (tooSlow) return t().race.rampRunUpOrPass;
  return jump.hasItem === false ? t().race.rampStraight : t().race.rampItem;
}

export function windowJumpHeight(
  map: MapConfig,
  kart: Partial<Pick<KartState, 'x' | 'z' | 'levelId' | 'windowJumpId' | 'penaltySecondsLeft' | 'windowJumpElapsedSeconds'>>,
): number {
  const jump = jumpById(map, kart.windowJumpId ?? null);
  if ((kart.penaltySecondsLeft ?? 0) > 0) return 0;
  if (!jump) return itemRampHeight(map, kart);
  const progress = (kart.windowJumpElapsedSeconds ?? 0) / jump.durationSeconds;
  return Math.sin(progress * Math.PI) * jump.peakHeight + (jump.optional ? (jump.rampHeight ?? 0.65) * (1 - progress) : 0);
}

function itemRampHeight(map: MapConfig, kart: Partial<Pick<KartState, 'x' | 'z' | 'levelId'>>): number {
  if (kart.x === undefined || kart.z === undefined) return 0;
  let height = 0;
  for (const jump of map.windowJumps ?? []) {
    if (jump.optional && jump.levelId === kart.levelId) height = Math.max(height, heightOnItemRamp(jump, kart.x, kart.z));
  }
  return height;
}

function heightOnItemRamp(jump: WindowJump, x: number, z: number): number {
  const yaw = jump.launchYaw ?? 0;
  const dx = x - jump.launchRect.x;
  const dz = z - jump.launchRect.z;
  const along = dx * Math.cos(yaw) + dz * Math.sin(yaw) - (jump.takeoffOffset ?? 0);
  const across = Math.abs(-dx * Math.sin(yaw) + dz * Math.cos(yaw));
  const span = Math.abs(Math.sin(yaw)) * jump.launchRect.width + Math.abs(Math.cos(yaw)) * jump.launchRect.depth;
  const length = jump.rampLength ?? 4;
  if (along < -length || along > 0 || across > span / 2) return 0;
  return ((jump.rampHeight ?? 0.65) * (along + length)) / length;
}
