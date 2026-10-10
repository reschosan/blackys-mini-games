import { describe, expect, it } from 'vitest';
import type { StunEffectConfig } from '../../src/shared/config/items';
import { applyStunHit } from '../../src/games/kart/items/itemHit';
import { createKartState } from '../../src/games/kart/kart/kartState';

const STUN_CONFIG: StunEffectConfig = {
  stunSeconds: 0.8,
  velocityLossFactor: 0.35,
  spinYawRadians: 0.6,
};

describe('applyStunHit', () => {
  it('stuns, slows, and spins an unshielded kart', () => {
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 10;

    const blocked = applyStunHit(kart, STUN_CONFIG, 1);

    expect(blocked).toBe(false);
    expect(kart.stunSecondsLeft).toBe(STUN_CONFIG.stunSeconds);
    expect(kart.velocityX).toBeCloseTo(10 * STUN_CONFIG.velocityLossFactor);
    expect(kart.yaw).toBeCloseTo(STUN_CONFIG.spinYawRadians);
  });

  it('lets an active shield block the hit and consumes it instead', () => {
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 10;
    kart.shieldSecondsLeft = 5;

    const blocked = applyStunHit(kart, STUN_CONFIG, 1);

    expect(blocked).toBe(true);
    expect(kart.shieldSecondsLeft).toBe(0);
    expect(kart.stunSecondsLeft).toBe(0);
    expect(kart.velocityX).toBe(10);
    expect(kart.yaw).toBe(0);
  });

  it('keeps the race leader stunned for the leader bonus longer', () => {
    const leader = createKartState(0, 0, 0);
    leader.leading = true;
    const follower = createKartState(0, 0, 0);

    applyStunHit(leader, STUN_CONFIG, 1, 2);
    applyStunHit(follower, STUN_CONFIG, 1, 2);

    expect(leader.stunSecondsLeft).toBe(STUN_CONFIG.stunSeconds + 2);
    expect(follower.stunSecondsLeft).toBe(STUN_CONFIG.stunSeconds);
  });
});
