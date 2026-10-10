import type { ItemConfig } from '../../../shared/config/items';
import { KART_COLLIDER_RADIUS } from '../../../shared/config/kart';
import type { KartState } from '../kart/kartState';
import type { MapConfig } from '../maps/shared/mapConfig';
import { kartWorldHeightAt } from '../maps/shared/surface';
import { applyStunHit } from './itemHit';

export interface GravityBubble {
  readonly x: number;
  readonly z: number;
  readonly ownerIndex: number;
  readonly levelId: string;
  readonly elevation: number;
  secondsLeft: number;
  /** Karts already caught by this bubble; each one is caught only once. */
  readonly caughtKartIndices: number[];
}

/** Drops a bubble just behind the kart, so pursuers drive into it. */
export function spawnGravityBubble(state: KartState, ownerIndex: number, items: ItemConfig, map: MapConfig): GravityBubble {
  const offset = KART_COLLIDER_RADIUS + items.gravity.radiusMeters + items.gravity.spawnOffsetMeters;
  return {
    x: state.x - Math.cos(state.yaw) * offset,
    z: state.z - Math.sin(state.yaw) * offset,
    ownerIndex,
    levelId: state.levelId,
    elevation: kartWorldHeightAt(map, state),
    secondsLeft: items.gravity.lifetimeSeconds,
    caughtKartIndices: [],
  };
}

export function stepGravityBubbles(bubbles: GravityBubble[], items: ItemConfig, map: MapConfig, karts: readonly KartState[], stepSeconds: number): void {
  for (let index = bubbles.length - 1; index >= 0; index -= 1) {
    const bubble = bubbles[index]!;
    bubble.secondsLeft -= stepSeconds;
    if (bubble.secondsLeft <= 0) {
      bubbles.splice(index, 1);
      continue;
    }
    karts.forEach((kart, kartIndex) => catchKartInBubble(bubble, kart, kartIndex, items, map));
  }
}

function catchKartInBubble(bubble: GravityBubble, kart: KartState, kartIndex: number, items: ItemConfig, map: MapConfig): void {
  if (kartIndex === bubble.ownerIndex || bubble.caughtKartIndices.includes(kartIndex)) return;
  if (kart.levelId !== bubble.levelId || !isInsideBubble(bubble, kart, items, map)) return;
  bubble.caughtKartIndices.push(kartIndex);
  applyStunHit(kart, items.gravity, 1, items.leaderStunBonusSeconds);
}

function isInsideBubble(bubble: GravityBubble, kart: KartState, items: ItemConfig, map: MapConfig): boolean {
  const dx = kart.x - bubble.x;
  const dz = kart.z - bubble.z;
  const dy = kartWorldHeightAt(map, kart) - bubble.elevation;
  const radius = items.gravity.radiusMeters + KART_COLLIDER_RADIUS;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
