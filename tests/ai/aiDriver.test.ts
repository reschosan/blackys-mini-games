import { describe, expect, it } from 'vitest';
import { createAiDriverState, driveAiKart, type AiDriveContext } from '../../src/games/kart/ai/aiDriver';
import { aiGuideLine } from '../../src/games/kart/ai/aiGuideLine';
import { DEFAULT_AI, type AiConfig } from '../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY, type AiDifficultyTuning } from '../../src/shared/config/aiDifficulty';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { createKartState } from '../../src/games/kart/kart/kartState';

const STEP_SECONDS = 1 / 60;

function baseContext(overrides: Partial<AiDriveContext> = {}): AiDriveContext {
  return {
    config: { ...DEFAULT_AI },
    difficulty: { ...DEFAULT_AI_DIFFICULTY.medium },
    driving: createRuntimeDriving(),
    map: RING_TEST_MAP,
    aiState: createAiDriverState(),
    stepSeconds: STEP_SECONDS,
    otherKarts: [],
    rubberBanding: null,
    ...overrides,
  };
}

describe('driveAiKart', () => {
  it('rejoins its own guide line after leaving the house route', () => {
    const node = FAMILY_HOUSE.routeNodes![5]!;
    const state = createKartState(node.x + 8, node.z, 0, node.levelId);
    const aiState = createAiDriverState(2);
    aiState.routeNodeIndex = 6;

    const input = driveAiKart(state, baseContext({ map: FAMILY_HOUSE, aiState }));

    expect(aiState.repositioning).toBe(true);
    expect(input.accelerate || input.brake).toBe(true);
  });

  it('yields to a kart ahead when adjacent house lanes narrow', () => {
    const point = aiGuideLine(FAMILY_HOUSE, 1).points[3]!;
    const state = createKartState(point.x, point.z, 0, point.levelId);
    state.velocityX = 10;
    const aiState = createAiDriverState(1);
    aiState.routeNodeIndex = 4;
    const clear = driveAiKart(state, baseContext({ map: FAMILY_HOUSE, aiState }));
    const occupied = driveAiKart(state, baseContext({ map: FAMILY_HOUSE, aiState, otherKarts: [{ x: state.x + 2, z: state.z }] }));

    expect(clear.accelerate).toBe(true);
    expect(occupied.brake).toBe(true);
  });

  it('accelerates without braking or drifting on a straight', () => {
    const state = createKartState(51, 0, Math.PI / 2);
    const input = driveAiKart(state, baseContext());
    expect(input.accelerate).toBe(true);
    expect(input.brake).toBe(false);
    expect(input.drift).toBe(false);
  });

  it('brakes or drifts approaching the rectangular corner ahead', () => {
    const state = createKartState(-48, -43, Math.PI);
    state.velocityX = -13; // above the corner's target speed, without overshooting the dynamic lookahead past the corner
    const aiState = createAiDriverState();
    // The sharpness reading is smoothed over ~0.25s, so give it a few ticks to catch up.
    let input = driveAiKart(state, baseContext({ aiState }));
    for (let i = 0; i < 30; i += 1) {
      input = driveAiKart(state, baseContext({ aiState }));
    }
    expect(input.brake || input.drift).toBe(true);
    expect(input.steer).not.toBe(0);
  });

  it('drifts instead of braking once the corner is sharp enough', () => {
    const state = createKartState(-48, -43, Math.PI);
    state.velocityX = -13; // fast enough that drifting is worthwhile, without overshooting the lookahead
    const difficulty: AiDifficultyTuning = { ...DEFAULT_AI_DIFFICULTY.medium, driftAngleThreshold: 0.01 };
    const aiState = createAiDriverState();
    let input = driveAiKart(state, baseContext({ difficulty, aiState }));
    for (let i = 0; i < 30; i += 1) {
      input = driveAiKart(state, baseContext({ difficulty, aiState }));
    }
    expect(input.drift).toBe(true);
    expect(input.brake).toBe(false);
  });

  it('does not brake in a corner once already at or below the speed the corner needs', () => {
    const state = createKartState(-36, -43, Math.PI);
    state.velocityX = -6; // well below the corner's target speed already
    const aiState = createAiDriverState();
    let input = driveAiKart(state, baseContext({ aiState }));
    for (let i = 0; i < 30; i += 1) {
      input = driveAiKart(state, baseContext({ aiState }));
    }
    expect(input.brake).toBe(false);
  });

  it('never brakes once it has slowed below the minimum brake speed, to avoid flipping into reverse', () => {
    const state = createKartState(-36, -43, Math.PI);
    state.velocityX = -1; // already slow, below minBrakeSpeed
    state.velocityZ = 0;
    const input = driveAiKart(state, baseContext());
    expect(input.brake).toBe(false);
  });

  it('steers away from another kart blocking the way ahead', () => {
    const state = createKartState(51, 0, -Math.PI / 2); // facing along the map toward -z
    const difficulty: AiDifficultyTuning = { ...DEFAULT_AI_DIFFICULTY.medium, steerGain: 0.1 }; // avoid saturating steer at +/-1

    const straightAiState = createAiDriverState();
    let straightInput = driveAiKart(state, baseContext({ difficulty, aiState: straightAiState }));
    for (let i = 0; i < 30; i += 1) {
      straightInput = driveAiKart(state, baseContext({ difficulty, aiState: straightAiState }));
    }

    // Slightly to one side, so avoidance has a clear direction; the avoidance push is smoothed over
    // ~0.2s, so give it a few ticks to catch up too.
    const blockingKart = [{ x: 52, z: -4 }];
    const avoidingAiState = createAiDriverState();
    let avoidingInput = driveAiKart(state, baseContext({ difficulty, aiState: avoidingAiState, otherKarts: blockingKart }));
    for (let i = 0; i < 30; i += 1) {
      avoidingInput = driveAiKart(state, baseContext({ difficulty, aiState: avoidingAiState, otherKarts: blockingKart }));
    }

    expect(avoidingInput.steer).not.toBeCloseTo(straightInput.steer, 2);
  });

  it('repositions back toward the centreline once knocked far enough off it', () => {
    const state = createKartState(51, 0, Math.PI / 2);
    state.x = 51 + DEFAULT_AI.maxLateralOffset + 1; // shoved sideways, e.g. by a collision
    const aiState = createAiDriverState();

    const input = driveAiKart(state, baseContext({ aiState }));
    expect(aiState.repositioning).toBe(true);
    expect(input.accelerate || input.brake).toBe(true);
  });

  it('resumes normal driving once back within tolerance of the centreline', () => {
    const guideStart = aiGuideLine(RING_TEST_MAP, 0).points[0]!;
    const state = createKartState(guideStart.x, guideStart.z, -Math.PI / 2);
    const aiState = createAiDriverState();
    aiState.repositioning = true;

    const input = driveAiKart(state, baseContext({ aiState }));
    expect(aiState.repositioning).toBe(false);
    expect(input.accelerate).toBe(true);
  });

  it('falls back to backing away from an obstacle once repositioning itself stalls', () => {
    const state = createKartState(86, 0, Math.PI / 2); // beside the wall at x=88
    const config: AiConfig = { ...DEFAULT_AI };
    const aiState = createAiDriverState();
    aiState.repositioning = true;

    const input = driveAiKart(state, baseContext({ config, aiState, stepSeconds: config.stuckSecondsThreshold + 0.1 }));
    expect(aiState.repositionForcedReverse).toBe(true);
    expect(input.brake).toBe(true);
  });

  it('leaves the backing-away mode once nothing is close any more and heads back to the line', () => {
    // Regression test for a kart that kept backing or driving away for tens of metres after the
    // obstacle it was stuck against was long out of reach.
    const state = createKartState(51, 0, Math.PI / 2);
    state.x = 51 + DEFAULT_AI.maxLateralOffset + 1;
    const aiState = createAiDriverState();
    aiState.repositioning = true;
    aiState.repositionForcedReverse = true;
    aiState.escapeGear = 'reverse';

    driveAiKart(state, baseContext({ aiState }));

    expect(aiState.repositionForcedReverse).toBe(false);
    expect(aiState.escapeGear).toBeNull();
  });

  it('does not flip between two equally distant walls while escaping', () => {
    // Regression test for a kart in the middle of a corridor: the nearer wall changed every tick,
    // so gas and brake alternated and the kart never moved.
    const state = createKartState(86, 0, Math.PI / 2);
    const aiState = createAiDriverState();
    aiState.repositioning = true;
    aiState.repositionForcedReverse = true;
    aiState.escapeGear = 'forward';

    for (const yawJitter of [0.01, -0.01, 0.02, -0.02]) {
      state.yaw = Math.PI / 2 + yawJitter;
      driveAiKart(state, baseContext({ aiState }));
      expect(aiState.escapeGear).toBe('forward');
    }
  });

  it('keeps its reposition gear while the line target sits beside the kart', () => {
    // Regression test: a target directly to the side made the forward/behind sign flip every tick,
    // so the kart alternated gas and brake in place.
    const aiState = createAiDriverState();
    aiState.repositioning = true;
    const state = createKartState(51 + DEFAULT_AI.maxLateralOffset + 1, 0, Math.PI / 2);

    const first = driveAiKart(state, baseContext({ aiState }));
    for (const yawJitter of [0.03, -0.03, 0.05, -0.05]) {
      state.yaw = Math.PI / 2 + yawJitter;
      const next = driveAiKart(state, baseContext({ aiState }));
      expect(next.accelerate).toBe(first.accelerate);
      expect(next.brake).toBe(first.brake);
    }
  });

  it('counts a kart wiggling in place as stuck, not as moving', () => {
    // Regression test: a pinned kart bounced between very low speeds and was never declared stuck.
    const config: AiConfig = { ...DEFAULT_AI };
    const aiState = createAiDriverState();
    aiState.repositioning = true;
    const state = createKartState(86, 0, Math.PI / 2);
    state.velocityX = 1.5; // above any plain speed threshold

    for (let tick = 0; tick < 60; tick += 1) {
      state.x = 86 + (tick % 2) * 0.1;
      driveAiKart(state, baseContext({ config, aiState }));
    }

    expect(aiState.repositionForcedReverse).toBe(true);
  });

  it('drives forward instead of reversing when the obstacle it hit is already behind it', () => {
    // Reversing away from something behind would drive straight back into it - regression test for
    // a bug where the escape always reversed regardless of which side the obstacle was on.
    const state = createKartState(86, 0, Math.PI); // facing away from the wall at x=88, wall is behind
    const config: AiConfig = { ...DEFAULT_AI };
    const aiState = createAiDriverState();
    aiState.repositioning = true;

    const input = driveAiKart(state, baseContext({ config, aiState, stepSeconds: config.stuckSecondsThreshold + 0.1 }));
    expect(aiState.repositionForcedReverse).toBe(true);
    expect(aiState.escapeGear).toBe('forward');
    expect(input.accelerate).toBe(true);
    expect(input.brake).toBe(false);
  });

  it('keeps the same escape gear across ticks instead of recomputing it every frame', () => {
    // Regression test for a bug where an obstacle sitting almost exactly to the side made the
    // forward/behind sign flip every tick from tiny yaw jitter, so the AI alternated gears every
    // frame and never actually moved.
    const state = createKartState(86, 0, Math.PI / 2 + 0.001);
    const config: AiConfig = { ...DEFAULT_AI };
    const aiState = createAiDriverState();
    aiState.repositioning = true;

    const first = driveAiKart(state, baseContext({ config, aiState, stepSeconds: config.stuckSecondsThreshold + 0.1 }));
    expect(aiState.repositionForcedReverse).toBe(true);
    const gearAfterFirst = aiState.escapeGear;

    state.yaw -= 0.01; // small jitter, as would happen in practice while stuck
    const second = driveAiKart(state, baseContext({ config, aiState, stepSeconds: STEP_SECONDS }));
    expect(aiState.escapeGear).toBe(gearAfterFirst);
    expect(second.accelerate).toBe(first.accelerate);
    expect(second.brake).toBe(first.brake);
  });

  it('accelerates less on easy difficulty than on hard once up to speed', () => {
    const state = createKartState(51, 0, Math.PI / 2);
    state.velocityX = 0;
    state.velocityZ = 27; // between easy and hard top speed

    const easyInput = driveAiKart(state, baseContext({ difficulty: { ...DEFAULT_AI_DIFFICULTY.easy } }));
    const hardInput = driveAiKart(state, baseContext({ difficulty: { ...DEFAULT_AI_DIFFICULTY.hard } }));

    expect(easyInput.accelerate).toBe(false);
    expect(hardInput.accelerate).toBe(true);
  });

  it('advances past a narrowly missed house route node instead of circling it', () => {
    const previous = aiGuideLine(FAMILY_HOUSE, 0).points[2]!;
    const target = aiGuideLine(FAMILY_HOUSE, 0).points[3]!;
    const state = createKartState(target.x + (target.x - previous.x) * 0.2, target.z + (target.z - previous.z) * 0.2, 0, target.levelId);
    const aiState = createAiDriverState();
    aiState.routeNodeIndex = 3;

    driveAiKart(state, baseContext({ map: FAMILY_HOUSE, aiState }));

    expect(aiState.routeNodeIndex).toBeGreaterThan(3);
  });

  it('accepts a near house waypoint when moving too slowly to turn onto it', () => {
    const target = aiGuideLine(FAMILY_HOUSE, 1).points[21]!;
    const state = createKartState(target.x - 2, target.z, 0, target.levelId);
    state.velocityX = 2;
    const aiState = createAiDriverState(1);
    aiState.routeNodeIndex = 21;

    driveAiKart(state, baseContext({ map: FAMILY_HOUSE, aiState }));

    expect(aiState.routeNodeIndex).toBeGreaterThan(21);
  });
});
