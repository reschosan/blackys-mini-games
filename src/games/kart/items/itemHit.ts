import type { StunEffectConfig } from '../../../shared/config/items';
import type { KartState } from '../kart/kartState';

/** Applies a hairball/trap-style hit to `kart`: if a shield is active, it blocks the hit and is
 *  consumed instead. Returns true when a shield blocked the hit. `impactSideSign` picks which
 *  way the spin-out kicks (+1/-1), computed by the caller from the hit geometry. The race leader
 *  stays stunned `leaderStunBonusSeconds` longer. */
export function applyStunHit(kart: KartState, config: StunEffectConfig, impactSideSign: 1 | -1, leaderStunBonusSeconds = 0): boolean {
  if (kart.shieldSecondsLeft > 0) {
    kart.shieldSecondsLeft = 0;
    return true;
  }

  kart.velocityX *= config.velocityLossFactor;
  kart.velocityZ *= config.velocityLossFactor;
  kart.stunSecondsLeft = config.stunSeconds + (kart.leading ? leaderStunBonusSeconds : 0);
  kart.driftDirection = 0;
  kart.driftCharge = 0;
  kart.driftStage = 0;
  kart.yaw += impactSideSign * config.spinYawRadians;
  return false;
}

/** A cow pat hit: no spin-out, the kart just slows down and then drives as if on mud for `stickySeconds`. A shield blocks it
 *  and is consumed. Returns true when a shield blocked the hit. The race leader stays stuck `leaderBonusSeconds` longer. */
export function applyStickyHit(
  kart: KartState,
  config: { readonly stickySeconds: number; readonly velocityLossFactor: number },
  leaderBonusSeconds = 0,
): boolean {
  if (kart.shieldSecondsLeft > 0) {
    kart.shieldSecondsLeft = 0;
    return true;
  }

  kart.velocityX *= config.velocityLossFactor;
  kart.velocityZ *= config.velocityLossFactor;
  kart.stickySecondsLeft = config.stickySeconds + (kart.leading ? leaderBonusSeconds : 0);
  return false;
}
