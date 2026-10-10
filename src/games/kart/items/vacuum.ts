import type { ItemConfig } from '../../../shared/config/items';
import type { KartState } from '../kart/kartState';
import { applyStunHit } from './itemHit';

export interface VacuumPulse {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly levelId: string;
  ageSeconds: number;
}

/** Fires the suction cone: every other kart inside it is stunned, slowed and pulled toward the
 *  user. A shield blocks the pull and is consumed, like for any other item hit. */
export function fireVacuum(user: KartState, userIndex: number, karts: readonly KartState[], items: ItemConfig): VacuumPulse {
  karts.forEach((kart, kartIndex) => {
    if (kartIndex !== userIndex && isInVacuumCone(user, kart, items)) pullTowardUser(user, kart, items);
  });
  return { x: user.x, z: user.z, yaw: user.yaw, levelId: user.levelId, ageSeconds: 0 };
}

function isInVacuumCone(user: KartState, kart: KartState, items: ItemConfig): boolean {
  if (kart.levelId !== user.levelId) return false;
  const dx = kart.x - user.x;
  const dz = kart.z - user.z;
  const distance = Math.hypot(dx, dz);
  if (distance === 0 || distance > items.vacuum.rangeMeters) return false;
  return (dx * Math.cos(user.yaw) + dz * Math.sin(user.yaw)) / distance >= Math.cos(items.vacuum.coneHalfAngleRadians);
}

function pullTowardUser(user: KartState, kart: KartState, items: ItemConfig): void {
  if (applyStunHit(kart, items.vacuum, 1, items.leaderStunBonusSeconds)) return;
  const dx = user.x - kart.x;
  const dz = user.z - kart.z;
  const distance = Math.hypot(dx, dz);
  kart.velocityX += (dx / distance) * items.vacuum.pullSpeedMetersPerSecond;
  kart.velocityZ += (dz / distance) * items.vacuum.pullSpeedMetersPerSecond;
}

export function stepVacuumPulses(pulses: VacuumPulse[], items: ItemConfig, stepSeconds: number): void {
  for (let index = pulses.length - 1; index >= 0; index -= 1) {
    const pulse = pulses[index]!;
    pulse.ageSeconds += stepSeconds;
    if (pulse.ageSeconds >= items.vacuum.pulseVisibleSeconds) pulses.splice(index, 1);
  }
}
