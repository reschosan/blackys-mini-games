import type { ItemConfig } from '../../../shared/config/items';
import { KART_COLLIDER_RADIUS } from '../../../shared/config/kart';
import { applyStickyHit, applyStunHit } from './itemHit';
import type { KartState } from '../kart/kartState';
import type { MapConfig } from '../maps/shared/mapConfig';
import { kartWorldHeightAt } from '../maps/shared/surface';

/** A cup spins the kart out; a cow pat only holds it like mud. */
export type TrapKind = 'cup' | 'cowpat';

export interface Trap {
  readonly kind?: TrapKind;
  readonly x: number;
  readonly z: number;
  readonly ownerIndex: number;
  readonly levelId: string;
  readonly elevation?: number;
}

function trapConfigOf(items: ItemConfig, kind: TrapKind | undefined): { readonly radius: number; readonly spawnOffsetMeters: number } {
  return kind === 'cowpat' ? items.cowpat : items.trap;
}

/** Drops a stationary trap just behind the kart's current facing direction. */
export function spawnTrap(state: KartState, ownerIndex: number, items: ItemConfig, map?: MapConfig, kind: TrapKind = 'cup'): Trap {
  const behindX = -Math.cos(state.yaw);
  const behindZ = -Math.sin(state.yaw);
  const { radius, spawnOffsetMeters } = trapConfigOf(items, kind);
  const offset = KART_COLLIDER_RADIUS + radius + spawnOffsetMeters;
  return {
    ...(kind === 'cup' ? {} : { kind }),
    x: state.x + behindX * offset,
    z: state.z + behindZ * offset,
    ownerIndex,
    levelId: state.levelId,
    ...(map ? { elevation: kartWorldHeightAt(map, state) } : {}),
  };
}

/** Removes a trap only after contact with an eligible non-owner kart. */
export function stepTraps(traps: Trap[], items: ItemConfig, karts: readonly KartState[], map?: MapConfig): void {
  for (let index = traps.length - 1; index >= 0; index -= 1) {
    const trap = traps[index]!;
    const hitRadius = KART_COLLIDER_RADIUS + trapConfigOf(items, trap.kind).radius;
    const hitRadiusSquared = hitRadius * hitRadius;

    const hitIndex = karts.findIndex((kart, kartIndex) => {
      if (kartIndex === trap.ownerIndex) return false;
      if (kart.levelId !== trap.levelId) return false;
      const dx = kart.x - trap.x;
      const dz = kart.z - trap.z;
      const dy = map ? kartWorldHeightAt(map, kart) - (trap.elevation ?? 0) : 0;
      return dx * dx + dy * dy + dz * dz <= hitRadiusSquared;
    });
    if (hitIndex === -1) continue;

    const kart = karts[hitIndex]!;
    const dx = kart.x - trap.x;
    const dz = kart.z - trap.z;
    const sideOfImpact = dx * -Math.sin(kart.yaw) + dz * Math.cos(kart.yaw);
    const impactSideSign = sideOfImpact >= 0 ? 1 : -1;
    if (trap.kind === 'cowpat') applyStickyHit(kart, items.cowpat, items.leaderStunBonusSeconds);
    else applyStunHit(kart, items.trap, impactSideSign, items.leaderStunBonusSeconds);
    traps.splice(index, 1);
  }
}
