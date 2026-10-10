import { describe, expect, it } from 'vitest';
import { shouldAiUseHeldItem, type MapPoint2D } from '../../src/games/kart/ai/aiDriver';
import { DEFAULT_AI } from '../../src/shared/config/ai';
import { createKartState } from '../../src/games/kart/kart/kartState';

const config = { ...DEFAULT_AI };

describe('shouldAiUseHeldItem', () => {
  it('fires a hairball at a kart ahead within range and cone', () => {
    const state = createKartState(0, 0, 0);
    const targetAhead: MapPoint2D[] = [{ x: config.itemAimRangeMeters - 1, z: 0 }];

    expect(shouldAiUseHeldItem(config, 'hairball', state, targetAhead, null)).toBe(true);
  });

  it('holds the hairball when the only other kart is behind, not ahead', () => {
    const state = createKartState(0, 0, 0);
    const targetBehind: MapPoint2D[] = [{ x: -5, z: 0 }];

    expect(shouldAiUseHeldItem(config, 'hairball', state, targetBehind, null)).toBe(false);
  });

  it('holds the hairball when the nearest kart ahead is out of range', () => {
    const state = createKartState(0, 0, 0);
    const farAhead: MapPoint2D[] = [{ x: config.itemAimRangeMeters + 5, z: 0 }];

    expect(shouldAiUseHeldItem(config, 'hairball', state, farAhead, null)).toBe(false);
  });

  it('drops a trap when a pursuer is close behind', () => {
    const state = createKartState(0, 0, 0);
    const pursuer: MapPoint2D[] = [{ x: -(config.trapPursuerRangeMeters - 1), z: 0 }];

    expect(shouldAiUseHeldItem(config, 'trap', state, pursuer, null)).toBe(true);
  });

  it('holds the trap when nobody is pursuing from behind', () => {
    const state = createKartState(0, 0, 0);
    const aheadOnly: MapPoint2D[] = [{ x: 5, z: 0 }];

    expect(shouldAiUseHeldItem(config, 'trap', state, aheadOnly, null)).toBe(false);
  });

  it('uses the shield once behind the leader by the configured deficit', () => {
    const state = createKartState(0, 0, 0);

    expect(shouldAiUseHeldItem(config, 'nap', state, [], { myScore: 0, leaderScore: config.napDeficitMeters })).toBe(true);
  });

  it('holds the shield while close behind the leader', () => {
    const state = createKartState(0, 0, 0);

    expect(shouldAiUseHeldItem(config, 'nap', state, [], { myScore: 0, leaderScore: config.napDeficitMeters - 1 })).toBe(false);
  });

  it('holds the shield without a rubber-banding context', () => {
    const state = createKartState(0, 0, 0);

    expect(shouldAiUseHeldItem(config, 'nap', state, [], null)).toBe(false);
  });

  it('uses catnip like nitro: only when not already boosting, stunned or on catnip', () => {
    const state = createKartState(0, 0, 0);
    expect(shouldAiUseHeldItem(config, 'catnip', state, [], null)).toBe(true);
    state.catnipSecondsLeft = 1;
    expect(shouldAiUseHeldItem(config, 'catnip', state, [], null)).toBe(false);
  });

  it('shoots laser, yarn and vacuum only at a kart ahead in their ranges', () => {
    const state = createKartState(0, 0, 0);
    const ahead: MapPoint2D[] = [{ x: config.vacuumTargetRangeMeters - 1, z: 0 }];
    const farAhead: MapPoint2D[] = [{ x: config.laserTargetRangeMeters + 5, z: 0 }];
    const behind: MapPoint2D[] = [{ x: -5, z: 0 }];

    for (const item of ['laser', 'yarn', 'vacuum'] as const) {
      expect(shouldAiUseHeldItem(config, item, state, ahead, null)).toBe(true);
      expect(shouldAiUseHeldItem(config, item, state, farAhead, null)).toBe(false);
      expect(shouldAiUseHeldItem(config, item, state, behind, null)).toBe(false);
    }
  });

  it('drops the gravity bubble for a pursuer close behind, not for a kart ahead', () => {
    const state = createKartState(0, 0, 0);
    expect(shouldAiUseHeldItem(config, 'gravity', state, [{ x: -4, z: 0 }], null)).toBe(true);
    expect(shouldAiUseHeldItem(config, 'gravity', state, [{ x: 4, z: 0 }], null)).toBe(false);
  });
});
