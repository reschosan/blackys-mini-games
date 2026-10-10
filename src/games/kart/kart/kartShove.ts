import type { KartState } from './kartState';

export interface ShoveConfig {
  readonly range: number;
  readonly coneDegrees: number;
  readonly speed: number;
  readonly flightSeconds: number;
  readonly cooldownSeconds: number;
}

/** Where the other kart lies seen from the shover: its distance and how far off the nose (radians). */
function bearingOf(from: KartState, to: KartState): { readonly distance: number; readonly offNose: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const angle = Math.atan2(dz, dx) - from.yaw;
  return { distance: Math.hypot(dx, dz), offNose: Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) };
}

function canShove(kart: KartState): boolean {
  return kart.shoveCooldownSeconds <= 0 && kart.airborneSecondsLeft <= 0;
}

/** The kart a shove would hit: the nearest one ahead within reach and within the cone, or null. */
export function shoveTarget(shover: KartState, others: readonly KartState[], config: ShoveConfig): KartState | null {
  const cone = (config.coneDegrees * Math.PI) / 180;
  let nearest: KartState | null = null;
  let nearestDistance = config.range;
  for (const other of others) {
    if (other === shover || other.airborneSecondsLeft > 0) continue;
    const { distance, offNose } = bearingOf(shover, other);
    if (offNose > cone || distance > nearestDistance) continue;
    nearest = other;
    nearestDistance = distance;
  }
  return nearest;
}

/** Would pressing the shove now hit somebody? */
export function hasShoveTarget(shover: KartState, others: readonly KartState[], config: ShoveConfig): boolean {
  return canShove(shover) && shoveTarget(shover, others, config) !== null;
}

/** The target flies away from the shover and hops; the shover has to wait for the next shove, also after a miss. Returns the kart it hit. */
export function shove(shover: KartState, others: readonly KartState[], config: ShoveConfig): KartState | null {
  if (!canShove(shover)) return null;
  shover.shoveCooldownSeconds = config.cooldownSeconds;
  const target = shoveTarget(shover, others, config);
  if (!target) return null;
  const distance = Math.hypot(target.x - shover.x, target.z - shover.z);
  const awayX = distance > 0 ? (target.x - shover.x) / distance : Math.cos(shover.yaw);
  const awayZ = distance > 0 ? (target.z - shover.z) / distance : Math.sin(shover.yaw);
  target.velocityX = awayX * config.speed;
  target.velocityZ = awayZ * config.speed;
  target.driftDirection = 0;
  target.driftCharge = 0;
  target.driftStage = 0;
  target.airborneSeconds = config.flightSeconds;
  target.airborneSecondsLeft = config.flightSeconds;
  return target;
}
